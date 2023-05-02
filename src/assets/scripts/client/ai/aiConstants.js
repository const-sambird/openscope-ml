/*
 * Defines several constants used in the AI project
 * Constants in the sense that once the simulation starts, they should be held constant
 * They might be changed with the configuration etc
 */

/**
 * The learning rate for an agent, alpha
 */
export const LEARNING_RATE = 0.2;

/**
 * The exploration rate for an agent, epsilon
 */
export const EXPLORATION_RATE = 0.8;

/**
 * The discount factor (how much we penalise the agent for staying alive)
 */
export const DISCOUNT_RATE = 0.99;

/**
 * Possible directional moves
 */
export const HEADINGS = {
    NORTH: 360,
    SOUTH: 180,
    EAST: 90,
    WEST: 270
};
