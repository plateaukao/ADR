2026-10-17

# Grip Fall stunt arena and GitHub Pages

Grip Fall turns the supplied ramp-climbing and jet-assisted landing footage into an interactive browser game. The player drives toward a tall ramp, uses vacuum force to hold contact through its swept-back top, then controls the return landing with jets. The upper ramp reverses the horizontal travel direction, and the landing zone sits well away from the foot to match the reference proportions.

The game is buildless HTML, CSS, and JavaScript. Two sampled cubic sections define the actual surface; the renderer and deterministic 120 Hz physics share the same position, tangent, and curvature data. Vacuum acts at the surface, while fuel-limited jets provide translation and pitch correction in flight. Space drives, Up Arrow applies suction, and Down Arrow fires downward exhaust to lift the car. The demonstration highlights the actual commands and assisted pitch outputs rather than merely displaying physical key presses.

The game is stored in the public [plateaukao/gripfall repository](https://github.com/plateaukao/gripfall). GitHub Pages is configured to publish from the root of main at [plateaukao.github.io/gripfall](https://plateaukao.github.io/gripfall/). Relative asset paths support the project URL, and .nojekyll permits direct static serving. Only the game, its regression check, README, and Git configuration are committed. Local reference images, design studies, screenshots, and analysis notes stay outside Git.

The physics checks cover the reference profile and landing distance, reversed launch, controlled touchdown, hard impacts, grip loss, vacuum release, four jet directions, pitch, and exhausted fuel. Chrome checks cover a complete demo, command highlights, manual controls, pause, help, and a phone-width layout.

Implementation commit: [8c6f234](https://github.com/plateaukao/gripfall/commit/8c6f234). Pages uses HTTPS and automatically publishes future changes pushed to main.
