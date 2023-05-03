import { max } from 'lodash';
import AircraftController from '../aircraft/AircraftController';
import AirportController from '../airport/AirportController';
import { FLIGHT_CATEGORY } from '../constants/aircraftConstants';
import EventBus from '../lib/EventBus';
import { isWithin } from '../math/core';
import { radiansToDegrees } from '../utilities/unitConverters';
import StateController from './StateController';
import { DISCOUNT_RATE, EXPLORATION_RATE, HEADINGS, LEARNING_RATE } from './aiConstants';
import { choose } from '../utilities/generalUtilities';

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

        this.init()
            ._setupHandlers()
            .enable();
    }

    init() {
        this.runwayHeading = this.getArrivalRunwayHeading();

        return this;
    }

    _setupHandlers() {
        return this;
    }

    enable() {
        return this;
    }

    getArrivalRunwayHeading() {        
        return radiansToDegrees(this.arrivalRunway.heading);
    }

    /**
     * This method is part of the game loop.
     * This method ruins the rest of the game loop.
     */
    update() {

    }

    /**
     * Gets the Q-value of a particular [state, action].
     * Returns 0 if we have never seen a particular state.
     *
     * @for AgentController
     * @method getQValue
     * @param {String} state the unique ID of a state
     * @param {Number} action the heading to fly
     * @returns {Number}
     */
    getQValue(state, action) {
        if (!(state in this.values)) return 0;

        return this.values[state][action];
    }

    /**
     * Computes max_action Q(state, action) over the legal
     * actions. This is the value at the state.
     *
     * @for AgentController
     * @method computeValueFromQValues
     * @param {String} state the unique ID of a state
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
     * @param {String} state the unique ID of a state
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
     * @param {String} state the state id
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
     * @param {String} state the state id
     * @param {Number} action the new heading
     * @param {String} nextState the next state id
     * @param {Number} reward this transition reward
     */
    transition(state, action, nextState, reward = 0) {
        if (!(state in this.values)) {
            this.values[state] = {};
            for (const heading of HEADINGS) {
                this.values[state][heading] = 0;
            }
        }

        const sample = reward + (this.discount * this.computeValueFromQValues(nextState));
        const current = this.getQValue(state, action);

        this.values[state][action] = ((1 - this.alpha) * current) + (this.alpha * sample);
    }

    /**
     * Gets the legal actions that we can take in this state:
     * we can't leave controlled airspace, and we can't divert
     * once we're cleared for approach.
     *
     * @param {String} state the unique ID of a state
     * @returns {Number[]}
     */
    getLegalActions(state) {
        const stateModel = this.stateController.getStateById(state);

        // if this is true, we should be cleared for approach and we're done
        const bearingToRunway = radiansToDegrees(stateModel.position.bearingToPosition(this.arrivalRunway.position));
        const arrivalDistanceCondition = stateModel.minDistance < 25;
        const arrivalHeadingCondition = isWithin(bearingToRunway - this.runwayHeading, -45, 45);

        if (arrivalDistanceCondition && arrivalHeadingCondition) return [];

        // if this isn't the outermost ring of states, we can move in any direction
        if (stateModel.minDistance !== max(Object.keys(this.stateController.states))) {
            return [HEADINGS.NORTH, HEADINGS.EAST, HEADINGS.SOUTH, HEADINGS.WEST];
        }

        const legalMoves = [];
        const heading = stateModel.startHeading;

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
