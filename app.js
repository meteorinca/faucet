document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('control-slider');
    const flowPercentageText = document.getElementById('flow-percentage');

    // Faucet Elements
    const waterFlow = document.getElementById('water-flow');
    const valveAssembly = document.getElementById('valve-assembly');

    // Transistor Elements
    const mainFlow = document.getElementById('main-flow');
    const baseFlow = document.getElementById('base-flow');

    function updateDemo() {
        const val = parseInt(slider.value, 10);

        // Update Text
        flowPercentageText.innerText = val;

        // --- FAUCET LOGIC ---
        // As value increases, valve gate moves left (opening the pipe)
        // Original X is 100. Let's move it left up to 40 pixels.
        const valveMove = (val / 100) * -40;
        valveAssembly.setAttribute('transform', `translate(${valveMove}, 0)`);

        // Water flow width increases as valve opens. Max width is 40.
        // Also adjust X so it expands out from the right side of the pipe.
        const maxWaterWidth = 40;
        const currentWaterWidth = (val / 100) * maxWaterWidth;
        const waterX = 150 - currentWaterWidth;

        waterFlow.setAttribute('width', currentWaterWidth);
        waterFlow.setAttribute('x', waterX);


        // --- TRANSISTOR LOGIC ---
        // Base current line gets thicker/brighter as input increases
        const baseThickness = (val / 100) * 8;
        baseFlow.setAttribute('stroke-width', baseThickness);

        // Main Collector-to-Emitter current gets thicker/brighter
        const mainThickness = (val / 100) * 16;
        mainFlow.setAttribute('stroke-width', mainThickness);
    }

    // Initialize state
    slider.addEventListener('input', updateDemo);
    updateDemo();
});