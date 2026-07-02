const panel = document.getElementById("transistorPanel");
const toggleBtn = document.getElementById("toggleBtn");
const autoBtn = document.getElementById("autoBtn");

const inputText = document.querySelector(".inputText");
const outputText = document.querySelector(".outputText");

const inputGroup = document.getElementById("inputParticles");
const outputGroup = document.getElementById("outputParticles");

const inputPath = document.getElementById("inputPath");
const topPath = document.getElementById("topPath");
const middlePath = document.getElementById("middlePath");
const bottomPath = document.getElementById("bottomPath");

let isOn = false;
let autoMode = false;
let autoTimer = null;

const inputParticles = [];
const outputParticles = [];

function makeParticle(group, className, size = 18) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");

  rect.setAttribute("width", size);
  rect.setAttribute("height", size);
  rect.setAttribute("rx", 2);
  rect.setAttribute("ry", 2);
  rect.classList.add("particle", className);

  group.appendChild(rect);
  return rect;
}

function createParticles() {
  for (let i = 0; i < 7; i++) {
    inputParticles.push({
      el: makeParticle(inputGroup, "inputParticle", 18),
      path: inputPath,
      offset: i / 7,
      speed: 0.007
    });
  }

  const outputTracks = [topPath, middlePath, bottomPath];

  outputTracks.forEach((path, trackIndex) => {
    for (let i = 0; i < 5; i++) {
      outputParticles.push({
        el: makeParticle(outputGroup, "outputParticle", 16),
        path,
        offset: i / 5 + trackIndex * 0.11,
        speed: 0.0055
      });
    }
  });
}

function moveParticle(particle) {
  const length = particle.path.getTotalLength();
  particle.offset = (particle.offset + particle.speed) % 1;

  const point = particle.path.getPointAtLength(length * particle.offset);

  const width = Number(particle.el.getAttribute("width"));
  const height = Number(particle.el.getAttribute("height"));

  particle.el.setAttribute("x", point.x - width / 2);
  particle.el.setAttribute("y", point.y - height / 2);
}

function animate() {
  if (isOn) {
    inputParticles.forEach(moveParticle);
    outputParticles.forEach(moveParticle);
  }

  requestAnimationFrame(animate);
}

function setState(nextState) {
  isOn = nextState;

  panel.classList.toggle("is-on", isOn);

  inputText.textContent = `Input = ${isOn ? 1 : 0}`;
  outputText.textContent = `Output = ${isOn ? 1 : 0}`;

  toggleBtn.textContent = isOn ? "Turn Input Off" : "Turn Input On";
}

function toggleState() {
  setState(!isOn);
}

function toggleAutoMode() {
  autoMode = !autoMode;

  if (autoMode) {
    autoBtn.textContent = "Stop Auto";
    autoTimer = setInterval(toggleState, 1600);
  } else {
    autoBtn.textContent = "Auto Play";
    clearInterval(autoTimer);
  }
}

toggleBtn.addEventListener("click", toggleState);
autoBtn.addEventListener("click", toggleAutoMode);

createParticles();
setState(false);
animate();
