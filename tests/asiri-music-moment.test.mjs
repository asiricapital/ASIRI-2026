import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {QUICK_MOMENTS,momentForHour,personalizeMomentPrompt} from '../asiri-music-staging/src/moment-core.js';

test('ASIRI Moment selects a deterministic daypart and keeps four one-tap presets',()=>{
  assert.equal(momentForHour(7).id,'morning');
  assert.equal(momentForHour(12).id,'coffee');
  assert.equal(momentForHour(17).id,'drive');
  assert.equal(momentForHour(22).id,'night');
  assert.equal(momentForHour(2).id,'night');
  assert.equal(QUICK_MOMENTS.length,4);
  assert.deepEqual(QUICK_MOMENTS.map(item=>item.id),['morning','coffee','drive','night']);
});

test('ASIRI Moment can personalize a generated session with the top taste artist',()=>{
  assert.equal(
    personalizeMomentPrompt('جلسة ليلية خليجية هادئة لمدة ساعة','محمد عبده'),
    'جلسة ليلية خليجية هادئة لمدة ساعة مع لمسة من محمد عبده'
  );
  assert.equal(personalizeMomentPrompt('جلسة قهوة',''),'جلسة قهوة');
});

test('ASIRI Moment is wired from home to the existing ASIRI DJ engine',async()=>{
  const html=await readFile('asiri-music-staging/index.html','utf8');
  const shell=await readFile('asiri-music-staging/src/os-shell.js','utf8');
  const dj=await readFile('asiri-music-staging/src/ai-dj.js','utf8');

  assert.match(html,/id="asiriMoment"/);
  assert.match(html,/id="osMomentPrimary"/);
  assert.match(html,/data-quick-moment/);
  assert.match(html,/moment\.css\?v=20260808-moment-v1/);
  assert.match(html,/ASIRI MOMENT/);
  assert.match(html,/<b>1\.9<\/b>/);
  assert.match(shell,/moment-core\.js\?v=20260808-moment-v1/);
  assert.match(shell,/asiri:ai-dj-prompt/);
  assert.match(dj,/asiri:ai-dj-prompt/);
  assert.match(dj,/generateSession\(\{promptOverride:prompt\}\)/);
});
