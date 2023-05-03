import _uniqueId from 'lodash/uniqueId';
import AirportModel from '../airport/AirportModel';
import DynamicPositionModel from '../base/DynamicPositionModel';
import StaticPositionModel from '../base/StaticPositionModel';
import { degrees_normalize } from '../math/circle';
import { isWithin } from '../math/core';
import { degreesToRadians, radiansToDegrees } from '../utilities/unitConverters';

/**
 * The range from `minDistance` that each StateModel should encompass.
 *
 * @for StateModel
 * @property DISTANCE_RANGE
 * @constant
 */
export const DISTANCE_RANGE = 5;

/**
 * The range from `startHeading` that each StateModel should encompass.
 * If this isn't divisible by 360 we're going to have a bad time
 *
 * @for StateModel
 * @property HEADING_RANGE
 * @constant
 */
export const HEADING_RANGE = 5;

export default class StateModel {
    /**
     * A StateModel represents a single state within the simulation.
     * This is challenging because openScope updates position data each tick, and each aircraft
     * could be in any (lat, lon) within the controllable airspace.
     *
     * The StateModel divides the airspace into different sectors centred at the airport.
     * Each state is defined using polar co-ordinates, with a minimum distance from the airport
     * and a heading where the sector starts. It ends one mile from the minimum distance and a
     * heading of five degrees clockwise from the initial heading.
     *
     * @for StateModel
     * @constructor
     * @param {Number} minDistance
     * @param {Number} startHeading in degrees
     * @param {AirportModel} airportModel
     */
    constructor(minDistance, startHeading, airportModel) {
        /**
         * A unique ID
         *
         * @for StateModel
         * @property id
         * @type {String}
         */
        this.id = _uniqueId('state-');

        /**
         *
         * @for StateModel
         * @property _minDistance
         * @type {Number}
         * @private
         */
        this._minDistance = minDistance;

        /**
         * The start heading in DEGREES
         *
         * @for StateModel
         * @property _minDistance
         * @type {Number}
         * @private
         */
        this._startHeading = startHeading;

        /**
         * The airport we're at
         *
         * @for StateModel
         * @property _airportModel
         * @type {AirportModel}
         * @private
         */
        this._airportModel = airportModel;

        /**
         * The position of the airport
         *
         * @for StateModel
         * @property _airportPosition
         * @type {StaticPositionModel}
         * @private
         */
        this._airportPosition = airportModel.positionModel;

        /**
         * The starting point from the airport
         *
         * @for StateModel
         * @property _position
         * @type {DynamicPositionModel}
         * @private
         */
        this._position = airportModel.positionModel.generateDynamicPositionFromBearingAndDistance(degreesToRadians(startHeading), minDistance);
    }

    get position() {
        return this._position;
    }

    get minDistance() {
        return this._minDistance;
    }

    get startHeading() {
        return this._startHeading;
    }

    /**
     * Is the given PositionModel in the area this state represents?
     *
     * @param {StaticPositionModel|DynamicPositionModel} positionModel
     */
    positionIsInState(positionModel) {
        const distanceFromAirport = this._airportPosition.distanceToPosition(positionModel);
        const bearingFromAirport = radiansToDegrees(this._airportPosition.bearingToPosition(positionModel));

        const distanceCondition = isWithin(distanceFromAirport, this._minDistance, this._minDistance + DISTANCE_RANGE);
        const bearingCondition = isWithin(bearingFromAirport, this.startHeading, degrees_normalize(this.startHeading + HEADING_RANGE));

        return distanceCondition && bearingCondition;
    }
}
