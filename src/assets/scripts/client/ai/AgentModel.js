import _isNil from 'lodash/isNil';
import AircraftModel from '../aircraft/AircraftModel';
import RunwayModel from '../airport/runway/RunwayModel';
import TimeKeeper from '../engine/TimeKeeper';
import UiController from '../ui/UiController';
import { km, radiansToDegrees } from '../utilities/unitConverters';
import { getOffset } from '../math/flightMath';
import { abs } from '../math/core';

/**
 * A single agent in the game
 * Can be thought of as the 'pilot' of each aircraft
 * 1:1 relationship between aircraft and agents
 *
 * @class AgentModel
 */
export default class AgentModel {
    constructor(aircraftModel) {
        /**
         * a reference to the AircraftModel this agent is 'flying'
         *
         * @for AgentModel
         * @property aircraftModel
         * @type {AircraftModel}
         */
        this.aircraftModel = aircraftModel;

        /**
         * a unique id for this agent
         */
        this.id = aircraftModel.id;

        /**
         * The last state we saw this agent in
         *
         * @for AgentModel
         * @property lastState
         * @type {StateModel}
         */
        this.lastState = false;

        /**
         * The state that this agent is moving to
         *
         * @for AgentModel
         * @property nextState
         * @type {StateModel}
         */
        this.nextState = '';

        /**
         * If we should remove this agent on the next state update
         *
         * @for AgentModel
         * @property shouldRemove
         * @type {boolean}
         */
        this.shouldRemove = false;
    }

    /**
     * Can the pilot intercept the glideslope?
     * If so, we should request ILS approach clearance, issue a reward, and stop controlling this agent
     *
     * Some of logic is copied from the `Pilot` class, but won't actually update the FMS and instead just
     * return a boolean. But the `Pilot` class is actually pretty lenient about allowing approach clearances,
     * so we need to impose some parameters (within a certain range of the end of the runway).
     *
     * @for AgentModel
     * @method canConductInstrumentApproach
     * @param {PositionModel} position - the state we're testing's position model
     * @param {RunwayModel} runwayModel - the runway we're approaching
     * @returns {Boolean} whether or not interception is possible
     */
    canConductInstrumentApproach(position, runwayModel) {
        if (_isNil(position)) {
            console.warn(`${this.id} is checking for an approach intercept with a bad position!`);
            return false;
        }

        if (_isNil(runwayModel)) {
            console.warn(`${this.id} attempted to intercept an approach for a nonexistent runway!`);
            return false;
        }

        const distanceToRunway = runwayModel.positionModel.distanceToPosition(this.aircraftModel.positionModel);

        if (distanceToRunway > 30 || distanceToRunway < 15) return false;

        const minimumGlideslopeInterceptAltitude = runwayModel.getMinimumGlideslopeInterceptAltitude();

        // this, rather presumptuously, assumes that altitude won't change between these states
        // but the variance shouldn't be massive between two states, so it's probably fine
        if (this.aircraftModel.mcp.altitude < minimumGlideslopeInterceptAltitude) {
            // eslint-disable-next-line max-len
            const warning = `${this.id} can't intercept the ILS runway ${runwayModel.name} because altitude is too low; this shouldn't be possible!`;
            console.warn(warning);
            UiController.ui_log(warning, true);
            return false;
        }

        // we should be checking that
        // (1) the aircraft is within 15 miles of the runway
        // (2) the aircraft's heading is within 40 degrees of the runway heading
        // (3) the aircraft's bearing is within 40 degrees of the runway heading
        const aircraftBearing = radiansToDegrees(runwayModel.positionModel.bearingFromPosition(this.aircraftModel.positionModel));
        const runwayHeading = radiansToDegrees(runwayModel.angle);
        const headingDifference = runwayHeading - aircraftBearing;

        // effectively we're allowing the heading to deviate by 10 degrees each way
        // for a total of 20
        if (headingDifference < -10 || headingDifference > 10) {
            return false;
        }

        const aircraftHeading = radiansToDegrees(this.aircraftModel.heading);
        const difference = aircraftHeading - runwayHeading;

        if (abs(difference) < 20) return false;

        UiController.ui_log(`${this.id} is able to intercept ${runwayModel.name}`, false);

        return true;
    }
}
