2026-10-17

# Remove distracting text and lights above the ramp

The game displayed an upper return curve annotation and glowing horizontal light fixtures above the ramp. They looked like meaningful controls or markings and distracted from the slope itself. Removing the annotation, decorative lamp bars, glow ellipses, and their unused gradient leaves the ramp silhouette unobstructed.

The change only deletes the generated label and static SVG decoration. The road geometry, controls, physics, and demo behavior are unchanged. Chrome verification confirms that the label and lamp fixtures are absent and the arena renders without JavaScript errors.

Commit: [085dd6b](https://github.com/plateaukao/gripfall/commit/085dd6b). The update is pushed to main for automatic GitHub Pages publication at [Grip Fall](https://plateaukao.github.io/gripfall/).
