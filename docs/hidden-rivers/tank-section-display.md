# Dye tank: section display contract

The section is a read-only view of the existing three-dimensional simulation. It does not create a two-dimensional simulation, apply forces, change the physical grid, advance the clock, or reset the water. Its position is the existing release-plane coordinate, from 0 to 18 cm through the tank.

WebGL samples the cell-centered dye, salinity, speed and curl textures on that physical plane, using the same spatial and temporal interpolation as the volume. The Canvas fallback interpolates between the two adjacent native z layers. Neither display adds physical resolution. Cutaway applies only to the volume.

The section camera projects physical x to screen right and physical y (depth below the lid) to screen down. It looks from positive rendering-world z; rendering-world y is the negative of physical y. In this projection, the calculated component omega_z = dv/dx - du/dy is positive for clockwise turning and negative for counterclockwise turning. Coral is positive and cyan is negative. This interpretation belongs to the section axes; rotating the volume changes its apparent orientation, not the diagnostic axis.

The scales are fixed across presets, frames and geometries: salinity 0–40 g/kg, speed 0–50 mm/s, curl magnitude 0–8 s^-1, and signed omega_z -8 to +8 s^-1. Signed color uses the existing square-root stretch around zero. Endpoints saturate. Section opacity is an artistic monotone function of concentration or diagnostic strength; it is not an additional measurement. Zero rotation is the dark neutral background. The section does not receive volume lighting, depth integration or a decorative flow field.

Acceptance checks: x-right/y-down projection and physical plane picking; display switching preserves paused time and salt/dye integrals; both signs are visibly distinguishable after a dense drop develops; primary controls and legend are visible on desktop and mobile; presentation fills the viewport and removes text; the existing volume and embedded lesson continue to work.
