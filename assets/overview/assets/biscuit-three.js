import * as THREE from './three/three.module.js';
import { GLTFLoader } from './three/GLTFLoader.js';

const viewers = document.querySelectorAll('.personal-biscuit-viewer[data-model-url]');

viewers.forEach((viewer) => {
  const canvas = viewer.querySelector('canvas');
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (error) {
    console.error('Não foi possível iniciar o visualizador Three.js do corvo.', error);
    viewer.dataset.modelState = 'error';
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
  camera.position.set(0, 0, -6.3);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x77716b, 2.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xd8e4ff, 1.1);
  fillLight.position.set(-4, 1, 2);
  scene.add(fillLight);

  const modelRoot = new THREE.Group();
  scene.add(modelRoot);
  let model = null;
  let baseRotationY = 0;
  let targetRotationX = 0;
  let targetRotationY = 0;

  function resize() {
    const width = Math.max(1, viewer.clientWidth);
    const height = Math.max(1, viewer.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  new ResizeObserver(resize).observe(viewer);
  resize();

  viewer.addEventListener('pointermove', (event) => {
    const bounds = viewer.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    targetRotationY = baseRotationY + (x - 0.5) * 1.05;
    targetRotationX = (y - 0.5) * 0.32;
  });
  viewer.addEventListener('pointerleave', () => {
    targetRotationY = baseRotationY;
    targetRotationX = 0;
  });

  function animate() {
    requestAnimationFrame(animate);
    modelRoot.rotation.y += (targetRotationY - modelRoot.rotation.y) * 0.075;
    modelRoot.rotation.x += (targetRotationX - modelRoot.rotation.x) * 0.075;
    renderer.render(scene, camera);
  }
  animate();

  fetch(viewer.dataset.modelUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((encoded) => {
      const binary = atob(encoded.trim());
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Promise((resolve, reject) => {
        new GLTFLoader().parse(bytes.buffer, '', resolve, reject);
      });
    })
    .then((gltf) => {
      model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const largestSide = Math.max(size.x, size.y, size.z) || 1;
      const scale = 3 / largestSide;
      model.position.set(0, 0, 0);
      model.rotation.x = Math.PI / 2;
      model.rotation.z = Math.PI;
      model.scale.setScalar(scale);
      const centerInView = center.clone()
        .multiplyScalar(scale)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
      modelRoot.position.set(-centerInView.x, -centerInView.y, -centerInView.z);
      modelRoot.add(model);
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.visible = true;
        object.frustumCulled = false;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          material.side = THREE.DoubleSide;
          material.needsUpdate = true;
        });
      });
      baseRotationY = 0.12;
      modelRoot.rotation.y = baseRotationY;
      targetRotationY = baseRotationY;
      viewer.dataset.modelState = 'loaded';
    })
    .catch((error) => {
      viewer.dataset.modelState = 'error';
      console.error('Não foi possível carregar o modelo 3D do corvo.', error);
    });
});
