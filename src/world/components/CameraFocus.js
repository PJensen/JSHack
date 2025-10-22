// CameraFocus.js
// ECS Component: Tag indicating the camera should follow this entity
import { defineComponent } from '../../lib/ecs/core.js';

export const CameraFocus = defineComponent('CameraFocus', {
  active: true
});
