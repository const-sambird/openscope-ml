For the original openScope repository, please click [here](https://github.com/openscope/openscope).

# openscope-ml: openScope with Q-learning

## What is this?

This is my final project for CS 5013: Artifical Intelligence at the University of Oklahoma. It modifies arriving aircraft to have Q-learning reinforcement agents that gradually learn to fly themselves towards a point where they can request arrival clearance. More information is available in [the report](./cs5013_proj.pdf).

## What files were modified?

Most of the modifications are made in the [`ai/`](./src/assets/scripts/client/ai/) folder. Some consequential modifications were made to the AppController (to instantiate the new classes) and the AirportController (to disallow changing the airport, which would break everything).

`einn.json` is a copy of the Q-values after several hours of learning. They can be reloaded into the simulation through the console, as the `AgentController` is attached to the window and has a method which accepts a JSON string of Q-values.
