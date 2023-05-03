import { floor, forOwn, max } from 'lodash';
import AircraftController from '../aircraft/AircraftController';
import AirportController from '../airport/AirportController';
import { FLIGHT_CATEGORY, FLIGHT_PHASE } from '../constants/aircraftConstants';
import EventBus from '../lib/EventBus';
import { isWithin, round } from '../math/core';
import { radiansToDegrees } from '../utilities/unitConverters';
import StateController from './StateController';
import {
    DISCOUNT_RATE,
    EXPLORATION_RATE,
    HEADINGS,
    LEARNING_RATE
} from './aiConstants';
import { choose } from '../utilities/generalUtilities';
import AgentModel from './AgentModel';
import AircraftModel from '../aircraft/AircraftModel';
import { EVENT } from '../constants/eventNames';
import UiController from '../ui/UiController';

export default class AgentController {
    constructor(aircraftController) {
        /**
         * an instance of the aircraft controller
         *
         * @for AgentController
         * @property aircraftController
         * @type {AircraftController}
         */
        this.aircraftController = aircraftController;

        /**
         * the AirportModel
         */
        this.airport = AirportController.airport_get();

        /**
         * a StateController
         *
         * @for AgentController
         * @property stateController
         * @type {StateController}
         */
        this.stateController = new StateController(this.airport);

        /**
         * the reference to the static EventBus
         *
         * @for AgentController
         * @property _eventBus
         * @type {EventBus}
         */
        this._eventBus = EventBus;

        /**
         * All of the agents
         *
         * @for AgentController
         * @property agents
         * @type {AgentModel[]}
         */
        this.agents = {};

        /**
         * Q values
         *
         * @for AgentController
         * @property _values
         * @type {Object}
         */
        this.values = {};

        /**
         * the learning rate, alpha
         *
         * @for AgentModel
         * @property alpha
         * @type {Number}
         */
        this.alpha = LEARNING_RATE;

        /**
         * the exploration rate, epsilon
         *
         * @for AgentModel
         * @property epsilon
         * @type {Number}
         */
        this.epsilon = EXPLORATION_RATE;

        /**
         * the discount rate (living penalty)
         *
         * @for AgentModel
         * @property discount
         * @type {Number}
         */
        this.discount = DISCOUNT_RATE;

        // TODO: jsdoc
        this.arrivalRunway = this.airport.getActiveRunwayForCategory(FLIGHT_CATEGORY.ARRIVAL);

        return this.init()
            ._setupHandlers()
            .enable();
    }

    init() {
        this.runwayHeading = this.getArrivalRunwayHeading();

        for (const aircraft of this.aircraftController.aircraft.list) {
            if (aircraft.category === FLIGHT_CATEGORY.ARRIVAL && aircraft.isInsideAirspace(this.airport)) {
                this.agents[aircraft.id] = new AgentModel(aircraft);
            }
        }

        return this;
    }

    _setupHandlers() {
        this._aircraftAddedHandler = this.aircraftAdded.bind(this);
        this._aircraftRemovedHandler = this.aircraftRemoved.bind(this);

        this._eventBus.on(EVENT.AIRSPACE_ENTER, this._aircraftAddedHandler);
        this._eventBus.on(EVENT.ADD_AIRCRAFT, this._aircraftAddedHandler);
        this._eventBus.on(EVENT.REMOVE_AIRCRAFT, this._aircraftRemovedHandler);

        return this;
    }

    enable() {
        window.agentController = this;
        return this;
    }

    getArrivalRunwayHeading() {
        return round(radiansToDegrees(this.arrivalRunway.angle));
    }

    /**
     * This method is part of the game loop.
     * This method ruins the rest of the game loop.
     */
    update() {
        const stateUpdates = [];

        forOwn(this.agents, (agent, id) => {
            const currentState = this.stateController.getStateByAircraft(agent.aircraftModel);
            if (currentState !== agent.lastState) {
                agent.nextState = currentState;
                stateUpdates.push(agent);
            }
        });

        for (const agent of stateUpdates) {
            const oldPos = agent.lastState.position ?? null;
            const nextPos = agent.nextState.position;

            if (agent.lastState) {
                const bearing = radiansToDegrees(oldPos.bearingToPosition(nextPos));

                let action;

                if (bearing <= 45 || bearing > 315) {
                    action = HEADINGS.NORTH;
                } else if (bearing > 45 && bearing <= 135) {
                    action = HEADINGS.EAST;
                } else if (bearing > 135 && bearing <= 225) {
                    action = HEADINGS.SOUTH;
                } else {
                    action = HEADINGS.WEST;
                }

                let reward = 0;

                if (agent.canConductInstrumentApproach(agent.aircraftModel.positionModel, this.arrivalRunway)) {
                    reward = 1000;
                } else if (!agent.aircraftModel.isInsideAirspace(this.airport)) {
                    reward = -1000;
                }

                this.transition(agent.lastState, action, agent.nextState, reward);
                UiController.ui_log(`${agent.aircraftModel.callsign}: ((${agent.lastState.minDistance}, ${agent.lastState.startHeading}), ${action}) => (${agent.nextState.minDistance}, ${agent.nextState.startHeading}) = ${reward}`);
            }

            agent.lastState = agent.nextState;
            agent.nextState = '';

            if (agent.canConductInstrumentApproach(agent.aircraftModel.positionModel, this.arrivalRunway)) {
                const response = agent.aircraftModel.pilot.conductInstrumentApproach(agent.aircraftModel, 'ils', this.arrivalRunway);
                UiController.ui_log(`${agent.aircraftModel.callsign}, ${response[1].log}`, !response[0]);
                this.aircraftRemoved(agent.aircraftModel);
                continue;
            } else if (!agent.aircraftModel.isControllable) {
                continue;
            }

            const action = this.getAction(agent.lastState);
            if (!action) continue;
            const readback = agent.aircraftModel.pilot.maintainHeading(agent.aircraftModel, action, '', false);

            UiController.ui_log(`${agent.aircraftModel.callsign}, ${readback[1].log}`, !readback[0]);
        }
    }

    /**
     * Handles an aircraft being added to the game.
     *
     * @for AgentController
     * @method aircraftAdded
     * @param {AircraftModel} aircraft
     */
    aircraftAdded(aircraft) {
        if (aircraft.category === FLIGHT_CATEGORY.ARRIVAL) {
            this.agents[aircraft.id] = new AgentModel(aircraft);
        }
    }

    /**
     * Handles an aircraft being removed from the game.
     *
     * @for AgentController
     * @method aircraftRemoved
     * @param {AircraftModel} aircraft
     */
    aircraftRemoved(aircraft) {
        delete this.agents[aircraft.id];
    }

    /**
     * Gets the Q-value of a particular [state, action].
     * Returns 0 if we have never seen a particular state.
     *
     * @for AgentController
     * @method getQValue
     * @param {StateModel} state
     * @param {Number} action the heading to fly
     * @returns {Number}
     */
    getQValue(state, action) {
        if (!(state.id in this.values)) return 0;

        return this.values[state.id][action];
    }

    /**
     * Computes max_action Q(state, action) over the legal
     * actions. This is the value at the state.
     *
     * @for AgentController
     * @method computeValueFromQValues
     * @param {StateModel} state
     * @returns {Number}
     */
    computeValueFromQValues(state) {
        const action = this.computeActionFromQValues(state);
        if (!action) return 0;

        return this.getQValue(state, action);
    }

    /**
     * Computes the best action to take at a given state, or false if there is none.
     *
     * @param {StateModel} state
     * @returns {Number|none}
     */
    computeActionFromQValues(state) {
        const legalActions = this.getLegalActions(state);
        let bestActions = [];
        let qMax = Number.MIN_VALUE;

        if (legalActions.length === 0) {
            return false;
        }

        for (const action of legalActions) {
            const q = this.getQValue(state, action);
            if (q > qMax) {
                qMax = q;
                bestActions = [action];
            } else if (q === qMax) {
                bestActions.push(action);
            }
        }

        return choose(bestActions);
    }

    /**
     * Chooses an action to take in the current state.
     * With the probability epsilon, we should take a random legal
     * action (explore); otherwise we should just take the best action.
     *
     * @for AgentController
     * @method getAction
     * @param {StateModel} state
     * @returns {Number|false} the action, or false if none exists
     */
    getAction(state) {
        const legalActions = this.getLegalActions(state);
        if (legalActions.length === 0) return false;

        if (Math.random() < this.epsilon) {
            return choose(legalActions);
        }

        return this.computeActionFromQValues(state);
    }

    /**
     * Updates a single (state, action) => nextState transition.
     *
     * @for AgentController
     * @method transition
     * @param {StateModel} state the current state
     * @param {Number} action the new heading
     * @param {StateModel} nextState the next state
     * @param {Number} reward this transition reward
     */
    transition(state, action, nextState, reward = 0) {
        if (!(state.id in this.values)) {
            this.values[state.id] = {};
            for (const heading of [HEADINGS.NORTH, HEADINGS.EAST, HEADINGS.SOUTH, HEADINGS.WEST]) {
                this.values[state.id][heading] = 0;
            }
        }

        const sample = reward + (this.discount * this.computeValueFromQValues(nextState));
        const current = this.getQValue(state, action);

        this.values[state.id][action] = ((1 - this.alpha) * current) + (this.alpha * sample);
    }

    /**
     * Gets the legal actions that we can take in this state:
     * we can't leave controlled airspace, and we can't divert
     * once we're cleared for approach.
     *
     * @param {StateModel} state
     * @returns {Number[]}
     */
    getLegalActions(state) {
        // if this is true, we should be cleared for approach and we're done
        const bearingToRunway = radiansToDegrees(state.position.bearingToPosition(this.arrivalRunway.positionModel));
        const arrivalDistanceCondition = state.minDistance < 25;
        const arrivalHeadingCondition = isWithin(bearingToRunway - this.runwayHeading, -45, 45);

        if (arrivalDistanceCondition && arrivalHeadingCondition) return [];

        // if this isn't the outermost ring of states, we can move in any direction
        if (state.minDistance !== floor(this.airport.ctr_radius)) {
            return [HEADINGS.NORTH, HEADINGS.EAST, HEADINGS.SOUTH, HEADINGS.WEST];
        }

        const legalMoves = [];
        const heading = state.startHeading;

        if (heading < 90 || heading > 270) {
            // south is ok!
            legalMoves.push(HEADINGS.SOUTH);
        } else {
            // north is ok!
            legalMoves.push(HEADINGS.NORTH);
        }

        if (heading < 180) {
            // west is ok!
            legalMoves.push(HEADINGS.WEST);
        } else {
            // east is ok!
            legalMoves.push(HEADINGS.EAST);
        }

        return legalMoves;
    }
}
