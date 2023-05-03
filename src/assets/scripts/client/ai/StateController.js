import { ceil, floor } from 'lodash';
import AirportModel from '../airport/AirportModel';
import StaticPositionModel from '../base/StaticPositionModel';
import StateModel, { DISTANCE_RANGE, HEADING_RANGE } from './StateModel';
import AircraftModel from '../aircraft/AircraftModel';
import DynamicPositionModel from '../base/DynamicPositionModel';
import UiController from '../ui/UiController';

export default class StateController {
    constructor(airportModel) {
        /**
         * The airport that the states represent
         *
         * @for StateController
         * @property _airportModel
         * @type {AirportModel}
         * @private
         */
        this._airportModel = airportModel;

        /**
         * All the states, all of them
         *
         * @for StateController
         * @property _states
         * @type {StateModel[][]}
         * @private
         */
        this._states = {};

        /**
         * The states but done by id instead of relative position
         *
         * @for StateController
         * @property _statesId
         * @type {StateModel[]}
         * @private
         */
        this._statesId = {};

        /**
         * The position of the airport
         *
         * @for StateModel
         * @property _airportPosition
         * @type {StaticPositionModel}
         * @private
         */
        this._airportPosition = airportModel.positionModel;

        this.init()
            ._setupHandlers()
            .enable();
    }

    get states() {
        return this._states;
    }

    init() {
        this._buildStates();

        return this;
    }

    _setupHandlers() {
        return this;
    }

    enable() {
        return this;
    }

    _buildStates() {
        UiController.ui_log('building states...', false);

        const MAX_DISTANCE = ceil(this._airportModel.ctr_radius);
        const DISTANCE_INTERVAL = DISTANCE_RANGE;
        const HEADING_INTERVAL = HEADING_RANGE;
        UiController.ui_log(`max distance: ${MAX_DISTANCE}`, false);
        UiController.ui_log(`distance interval: ${DISTANCE_INTERVAL}`, false);
        UiController.ui_log(`heading interval: ${HEADING_INTERVAL}`, false);

        let count = 1;

        for (let distance = 0; distance < MAX_DISTANCE; distance += DISTANCE_INTERVAL) {
            this._states[distance] = [];
            for (let heading = 0; heading < 360; heading += HEADING_INTERVAL) {
                const model = new StateModel(distance, heading, this._airportModel);
                this._states[distance].push(model);
                this._statesId[model.id] = model;
                count += 1;
            }
        }

        UiController.ui_log(`built ${count} states.`, false);
    }

    /**
     * Gets the StateModel that has this position.
     *
     * @param {DynamicPositionModel} positionModel
     * @returns {StateModel|false} the StateModel that contains this position, or `false` otherwise
     */
    getStateByPosition(positionModel) {
        const distanceFromAirport = this._airportPosition.distanceToPosition(positionModel);
        const closestPositionMatch = floor(distanceFromAirport / DISTANCE_RANGE) * DISTANCE_RANGE;

        if (!this._states[closestPositionMatch]) {
            // probably an aircraft that's spawned too far away
            return false;
        }

        for (const state of this._states[closestPositionMatch]) {
            if (state.positionIsInState(positionModel)) {
                return state;
            }
        }

        return false;
    }

    /**
     * Gets the state that this AircraftModel is in.
     *
     * @param {AircraftModel} aircraftModel
     */
    getStateByAircraft(aircraftModel) {
        return this.getStateByPosition(aircraftModel.positionModel);
    }

    /**
     * Gets a state by its unique id.
     *
     * @param {String} id
     * @returns {StateModel|false}
     */
    getStateById(id) {
        return this._statesId[id] ?? false;
    }
}
