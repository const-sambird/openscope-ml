import AircraftController from '../aircraft/AircraftController';
import AirportController from '../airport/AirportController';
import { FLIGHT_CATEGORY } from '../constants/aircraftConstants';
import EventBus from '../lib/EventBus';
import { isWithin } from '../math/core';
import { radiansToDegrees } from '../utilities/unitConverters';
import StateController from './StateController';

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
        const a = 1;
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
        const bestActions = [];
        const qMax = Number.MIN_VALUE;

        if (legalActions.length === 0) {
            return false;
        }
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
    }
}
