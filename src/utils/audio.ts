let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Procedurally generates high-fidelity sound notification effects 
 * via standard modular Web Audio oscillators. Avoids heavy asset download sizes
 * and operates perfectly across all platforms and inside standard sandbox iframes.
 */
export function playNotificationTone(type: 'profit' | 'drawdown' | 'test_profit' | 'test_drawdown' | 'trade') {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const now = ctx.currentTime;
    
    if (type === 'profit' || type === 'test_profit') {
      // Pleasant high-pitch ascending arpeggio (C5 -> E5 -> G5 -> C6)
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'triangle'; // soft pleasant chime note
        osc.frequency.setValueAtTime(freq, now + idx * 0.10);
        
        gain.gain.setValueAtTime(0.12, now + idx * 0.10);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.10 + 0.25);
        
        osc.start(now + idx * 0.10);
        osc.stop(now + idx * 0.10 + 0.30);
      });
    } else if (type === 'drawdown' || type === 'test_drawdown') {
      // Alarm styled descending notes (D4 -> B3 -> G3)
      const freqs = [293.66, 246.94, 196.00];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sawtooth'; // synth buzzer
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, now);
        
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        
        gain.gain.setValueAtTime(0.10, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.35);
        
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.40);
      });
    } else if (type === 'trade') {
      // Short clean pop for standard trade entries
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (err) {
    console.warn("Web Audio Context not activated. Interact with preview viewport to unlock.", err);
  }
}
