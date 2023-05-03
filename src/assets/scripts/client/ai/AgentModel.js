import _isNil from 'lodash/isNil';
import AircraftModel from '../aircraft/AircraftModel';
import RunwayModel from '../airport/runway/RunwayModel';
import TimeKeeper from '../engine/TimeKeeper';
import UiController from '../ui/UiController';
import { km, radiansToDegrees } from '../utilities/unitConverters';
import { getOffset } from '../math/flightMath';

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

        const minimumGlideslopeInterceptAltitude = runwayModel.getMinimumGlideslopeInterceptAltitude();

        // this, rather presumptuously, assumes that altitude won't change between these states
        // but the variance shouldn't be massive between two states, so it's probably fine
        if (this.aircraftModel.mcp.altitude < minimumGlideslopeInterceptAltitude) {
            console.warn(`${this.id} can't intercept the ILS runway ${runwayModel.name} because altitude is too low; this shouldn't be possible!`);
            return false;
        }

        // we should be checking that
        // (1) the aircraft is within 25 miles of the runway
        // (2) the aircraft's heading is within 90 degrees of the runway heading
        const aircraftHeading = radiansToDegrees(this.aircraftModel.heading);
        const runwayHeading = radiansToDegrees(this.runwayModel.heading);
        const headingDifference = runwayHeading - aircraftHeading;

        // effectively we're allowing the heading to deviate by 45 degrees each way
        // for a total of 90
        if (headingDifference < -45 || headingDifference > 45) {
            return false;
        }

        const runwayPosition = runwayModel.positionModel.relativePosition;
        const [lat, long, distanceToRunway] = getOffset(this.aircraftModel, runwayPosition);

        if (distanceToRunway > km(25)) return false;

        UiController.ui_log(`${this.id} is able to intercept ${runwayModel.name}`, false);

        return true;
    }
}
