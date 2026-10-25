// The desk top's mirror: the room really drawn a second time from under the desk, every frame, so reflections slide
// as the camera swings and an object that lifts leaves its reflection behind. Reference: the glossy pale-blue desk
// in the film (film/ref/frames/P2/, the lamp and the vase standing on their own reflections) and three.js's planar
// Reflector (examples/jsm/objects/Reflector.js, MIT) for the method: a camera mirrored in the plane, and Lengyel's
// oblique near plane so nothing under the desk gets into the picture. look.js softens it and fades it with angle.
import * as THREE from 'three'

export function createMirror(renderer, scene, look, mesh, height) {
  const cam = new THREE.PerspectiveCamera()
  const target = new THREE.WebGLRenderTarget(4, 4, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true })
  const plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4(), up = new THREE.Vector3(), aim = new THREE.Vector3(), fwd = new THREE.Vector3()
  const normal = new THREE.Vector3(0, 1, 0), bias = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
  look.U.uMirror.value = target.texture

  function resize(w, h, scale) {
    const W = Math.max(8, Math.round(w * scale)), H = Math.max(8, Math.round(h * scale))
    if (target.width !== W || target.height !== H) { target.setSize(W, H); look.U.uTexel.value.set(1 / W, 1 / H) }
  }

  function render(camera) {
    // the camera, mirrored in the desk top
    cam.fov = camera.fov; cam.aspect = camera.aspect; cam.near = camera.near; cam.far = camera.far
    cam.updateProjectionMatrix()
    camera.getWorldDirection(fwd)
    aim.copy(camera.position).add(fwd)
    cam.position.set(camera.position.x, 2 * height - camera.position.y, camera.position.z)
    aim.y = 2 * height - aim.y
    up.set(0, 1, 0).applyQuaternion(camera.quaternion); up.y = -up.y
    cam.up.copy(up)
    cam.lookAt(aim)
    cam.updateMatrixWorld()
    cam.layers.mask = camera.layers.mask
    look.U.uMirrorVP.value.copy(bias).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse)
    // an oblique near plane on the desk top: only what stands above it is mirrored
    // (2.5 mm above it, not on it: a plane cutting through the foot of something that stands on the desk, the thick
    // base of the tumbler above all, left a speckle that flickered as the camera moved)
    plane.setFromNormalAndCoplanarPoint(normal, up.set(0, height + 0.0025, 0)).applyMatrix4(cam.matrixWorldInverse)
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant)
    const p = cam.projectionMatrix.elements
    q.x = (Math.sign(clip.x) + p[8]) / p[0]; q.y = (Math.sign(clip.y) + p[9]) / p[5]; q.z = -1; q.w = (1 + p[10]) / p[14]
    clip.multiplyScalar(2 / clip.dot(q))
    p[2] = clip.x; p[6] = clip.y; p[10] = clip.z + 1; p[14] = clip.w
    // beside the colour, how far from the mirrored eye each thing is (8 m = 1): the desk softens the image by it
    const alpha = renderer.getClearAlpha()
    look.U.uDepth.value.set(1 / 8, 0)
    look.U.uSpread.value = target.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))      // texels to a radian of view
    renderer.setClearAlpha(1)
    mesh.visible = false
    renderer.setRenderTarget(target)
    renderer.clear()
    renderer.render(scene, cam)
    renderer.setRenderTarget(null)
    mesh.visible = true
    renderer.setClearAlpha(alpha)
    look.U.uDepth.value.set(0, 0)
  }
  return { resize, render, dispose: () => target.dispose() }
}
