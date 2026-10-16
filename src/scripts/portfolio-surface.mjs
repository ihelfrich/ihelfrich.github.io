const root = document.querySelector('#surface-model');
const load = document.querySelector('#load-surface');
const status = document.querySelector('#surface-status');
load?.addEventListener('click', async () => {
  load.disabled = true;
  status.textContent = 'Loading the archived terrain mesh…';
  let renderer;
  try {
    const [T, { OrbitControls }] = await Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')]);
    const response = await fetch('/gis-portfolio/surface/metadata.json');
    if (!response.ok) throw new Error('Metadata could not be loaded.');
    const metadata = await response.json();
    const chunks = await Promise.all(metadata.chunks.map(async chunk => {
      const response = await fetch(`/gis-portfolio/surface/${chunk.file}`);
      if (!response.ok) throw new Error('A terrain chunk could not be loaded.');
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== chunk.bytes) throw new Error('Incomplete terrain download.');
      return { chunk, buffer };
    }));
    renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(getComputedStyle(root).backgroundColor);
    renderer.outputColorSpace = T.SRGBColorSpace;
    root.hidden = false;
    root.replaceChildren(renderer.domElement);
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'Southern Haiti terrain model. Drag to rotate, scroll to zoom; arrow keys rotate.');
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(42, 1, .1, 600);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 5;
    controls.maxDistance = 220;
    controls.maxPolarAngle = Math.PI * .92;
    const group = new T.Group();
    scene.add(group, new T.HemisphereLight(0xffffff, 0x304454, 2));
    const sun = new T.DirectionalLight(0xffffff, 2.8);
    sun.position.set(-40, 60, 25);
    scene.add(sun);
    const objects = [];
    for (const { chunk, buffer } of chunks) {
      const positions = new Float32Array(buffer, 0, chunk.vertices * 3);
      const elevations = new Float32Array(buffer, chunk.vertices * 12, chunk.vertices);
      const indices = new Uint32Array(buffer, chunk.vertices * 16, chunk.triangles * 3);
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
      geometry.setIndex(new T.BufferAttribute(indices, 1));
      const colors = new Float32Array(positions.length);
      const color = new T.Color();
      for (let i = 0; i < elevations.length; i++) {
        const h = elevations[i];
        if (h < 0) {
          const t = Math.min(-h / 4000, 1);
          color.setRGB(.12 + .08 * (1-t), .25 + .37 * (1-t), .42 + .26 * (1-t), T.SRGBColorSpace);
        } else {
          const t = Math.min(h / 2500, 1);
          color.setRGB(.43 + .42*t, .57 + .22*t, .39 + .29*t, T.SRGBColorSpace);
        }
        color.toArray(colors, i*3);
      }
      geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: T.DoubleSide });
      const mesh = new T.Mesh(geometry, material);
      // Points deliberately omit the triangle index: one displayed point per mesh vertex.
      const pointGeometry = new T.BufferGeometry();
      pointGeometry.setAttribute('position', geometry.getAttribute('position'));
      pointGeometry.setAttribute('color', geometry.getAttribute('color'));
      const points = new T.Points(pointGeometry, new T.PointsMaterial({ vertexColors: true, size: .075, sizeAttenuation: true }));
      points.visible = false;
      group.add(mesh, points);
      objects.push({ mesh, points });
    }
    const box = new T.Box3().setFromObject(group);
    const center = box.getCenter(new T.Vector3());
    const render = () => renderer.render(scene, camera);
    function reset() {
      controls.target.copy(center);
      camera.position.copy(center).add(new T.Vector3(44, 50, 63));
      controls.update();
      render();
    }
    const resize = new ResizeObserver(() => {
      camera.aspect = root.clientWidth / root.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(root.clientWidth, root.clientHeight);
      render();
    });
    resize.observe(root);
    controls.addEventListener('change', render);
    reset();
    document.querySelector('#surface-tools').hidden = false;
    const buttons = [...document.querySelectorAll('[data-surface-mode]')];
    for (const button of buttons) button.addEventListener('click', () => {
      const mode = button.dataset.surfaceMode;
      for (const {mesh, points} of objects) {
        mesh.visible = mode !== 'vertices';
        mesh.material.wireframe = mode === 'wireframe';
        points.visible = mode === 'vertices';
      }
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
      root.dataset.mode = mode;
      render();
    });
    document.querySelector('#surface-reset').addEventListener('click', reset);
    for (const button of document.querySelectorAll('[data-surface-zoom]')) button.addEventListener('click', () => {
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(Number(button.dataset.surfaceZoom));
      offset.clampLength(controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(offset);
      controls.update();
      render();
    });
    renderer.domElement.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new T.Spherical().setFromVector3(offset);
      if (event.key === 'ArrowLeft') spherical.theta -= .12;
      if (event.key === 'ArrowRight') spherical.theta += .12;
      if (event.key === 'ArrowUp') spherical.phi -= .12;
      if (event.key === 'ArrowDown') spherical.phi += .12;
      spherical.phi = Math.max(.05, Math.min(Math.PI*.92, spherical.phi));
      camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(spherical));
      controls.update();
      render();
    });
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      status.textContent = 'The graphics context was interrupted. Reload this page to restore the model.';
      root.dataset.state = 'interrupted';
    });
    root.dataset.state = 'ready';
    root.dataset.mode = 'surface';
    load.hidden = true;
    status.textContent = `${metadata.chunks.reduce((n,c)=>n+c.vertices,0).toLocaleString()} vertices · ${metadata.chunks.reduce((n,c)=>n+c.triangles,0).toLocaleString()} triangles · Drag to rotate, scroll to zoom. Mesh vertices are sampled elevations, not LiDAR returns.`;
  } catch (error) {
    console.error('Portfolio surface:', error.message);
    renderer?.dispose();
    root.hidden = true;
    root.dataset.state = 'error';
    status.textContent = 'The 3D model could not load. Please try again in a browser with WebGL enabled; the work samples above remain available.';
    load.disabled = false;
  }
});
