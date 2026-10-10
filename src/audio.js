const files = {
  rain: 'ylmir-rain-1.ogg', fire: 'original-swish-1.wav', hit: 'original-sword-sword-clash-1.ogg',
  dodge: 'original-sword-sword-1.ogg', thunder: 'rubberduck-sfx2-sfx100v2-thunder-01.ogg',
  steps: 'original-owlish-grass-footsteps.wav',
};

export function createAudio() {
  const context = new AudioContext(), master = context.createGain(); master.gain.value = 0.6; master.connect(context.destination);
  const buffers = {}, active = new Set(); let paused = true, muted = false, rainVoice = null, ready = false;
  const loading = Promise.all(Object.entries(files).map(async ([id, name]) => {
    const response = await fetch(new URL(`../assets/sfx/${name}`, import.meta.url));
    if (!response.ok) throw new Error(`Áudio indisponível: ${name}`);
    buffers[id] = await context.decodeAudioData(await response.arrayBuffer());
  })).then(() => { ready = true; });
  function play(id, volume = 0.4, rate = 1, loop = false) {
    if (paused || !buffers[id]) return null;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffers[id]; source.playbackRate.value = rate; source.loop = loop; gain.gain.value = volume;
    source.connect(gain); gain.connect(master); source.onended = () => { source.disconnect(); gain.disconnect(); active.delete(source); };
    active.add(source); source.start(); return { source, gain };
  }
  function stopAll() { for (const source of [...active]) source.stop(); rainVoice = null; }
  return {
    loading,
    async resume() { paused = false; await context.resume(); },
    pause() { paused = true; stopAll(); },
    mute(value) { muted = value; master.gain.value = muted ? 0 : 0.6; },
    event(e) {
      if (e.type === 'fire') play('fire', 0.35, 1.12);
      if (['hit', 'hurt'].includes(e.type)) play('hit', 0.35, e.type === 'hurt' ? 0.7 : 1);
      if (e.type === 'dodge') play('dodge', 0.22);
      if (['explosion', 'boss', 'victory'].includes(e.type)) play('thunder', 0.4, e.type === 'victory' ? 0.8 : 1);
      if (['seal', 'heal', 'portal', 'burst'].includes(e.type)) play('fire', 0.5, 0.65);
    },
    update(s, moving) {
      if (paused) return;
      if (!rainVoice && s.zone === 'outdoor') rainVoice = play('rain', 0.28, 1, true);
      if (rainVoice) rainVoice.gain.gain.setTargetAtTime(s.zone === 'outdoor' ? 0.28 : 0, context.currentTime, 0.3);
      if (moving && Math.floor(s.time * 2.3) !== Math.floor((s.time - 1 / 60) * 2.3)) play('steps', 0.025, s.zone === 'outdoor' ? 1 : 0.8);
      if (s.zone === 'outdoor' && s.time % 14 >= 10.2 && (s.time - 1 / 60) % 14 < 10.2) play('thunder', 0.25);
    },
    info() { return { ready, loaded: Object.keys(buffers).length, total: Object.keys(files).length, state: context.state, voices: active.size, paused, muted }; },
    dispose() { stopAll(); context.close(); },
  };
}
