// Proc state glyph badges — pulsing disc + unicode glyph rendered in world space above entities.
// Shared by the main render loop (src/main.js) and the visual test runner (tools/test-runner.html).

/** @type {Record<string, {glyph:string, r:number, g:number, b:number}>} */
export const PROC_STATE_VIS = {
	doom_clock:         { glyph: '\u231B',       r: 140, g: 60,  b: 220 },  // ⌛ hourglass — shadow countdown
	cataclysm_mark:     { glyph: '\u2726',       r: 255, g: 120, b: 30  },  // ✦ star — marked for detonation
	echo_strike_memory: { glyph: '\u{1F47B}',    r: 80,  g: 150, b: 255 },  // 👻 ghost — spectral echo stored
	soul_mortgage_debt: { glyph: '\u2696\uFE0F', r: 200, g: 50,  b: 50  },  // ⚖️ scales — debt accruing
};

/**
 * Draw proc state badge(s) above a world-space position.
 * The canvas context must already be scaled so that 1 unit = 1 tile.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} wx  world x (tile centre)
 * @param {number} wy  world y (tile centre)
 * @param {Array<{key:string, stacks:number}>} procStates
 * @param {number} fxTime  running time in seconds (for pulse animation)
 * @param {number} [entityId]  used for per-entity phase offset
 */
export function drawProcStateBadges(ctx, wx, wy, procStates, fxTime, entityId = 0) {
	if (!procStates || !procStates.length) return;
	const bx0 = wx + 0.30;
	const by  = wy - 0.54;
	for (let i = 0; i < procStates.length; i++) {
		const { key, stacks } = procStates[i];
		const vis = PROC_STATE_VIS[key];
		if (!vis) continue;
		const freq  = 2.2 + stacks * 0.9;
		const pulse = 0.72 + 0.28 * Math.sin(fxTime * freq + entityId * 0.91);
		const bx = bx0 + i * 0.38;
		const radius = 0.19;
		ctx.save();
		ctx.globalCompositeOperation = 'source-over';
		// Drop shadow
		ctx.globalAlpha = 0.55 * pulse;
		ctx.fillStyle = 'rgba(0,0,0,0.6)';
		ctx.beginPath();
		ctx.arc(bx, by, radius + 0.04, 0, Math.PI * 2);
		ctx.fill();
		// Colored disc
		ctx.globalAlpha = 0.88 * pulse;
		ctx.fillStyle = `rgba(${vis.r},${vis.g},${vis.b},0.45)`;
		ctx.beginPath();
		ctx.arc(bx, by, radius, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = `rgba(${vis.r},${vis.g},${vis.b},${(0.9 * pulse).toFixed(2)})`;
		ctx.lineWidth = 0.035;
		ctx.stroke();
		// Unicode glyph
		ctx.globalAlpha = pulse;
		ctx.font = '0.28px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#fff';
		ctx.fillText(vis.glyph, bx, by);
		// Stack counter (offset bottom-right if > 1)
		if (stacks > 1) {
			ctx.globalAlpha = 1.0;
			ctx.font = 'bold 0.15px monospace';
			ctx.fillStyle = '#ffdd00';
			ctx.fillText(String(stacks), bx + 0.13, by + 0.13);
		}
		ctx.restore();
	}
}
