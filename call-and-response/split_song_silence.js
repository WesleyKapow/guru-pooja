const stanzas = require("./stanzas.json");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// === CONFIG ===
const audioFile = "../guru-pooja-chant.mp3";

const outputDir = "temp";
const finalOutputDir = "stanzas";
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
if (!fs.existsSync(finalOutputDir)) fs.mkdirSync(finalOutputDir);

const audioLength = execSync(
  `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFile}"`
)
  .toString()
  .trim();
console.log(`Audio length: ${audioLength} seconds`, parseFloat(audioLength));

console.log(`Processing ${stanzas.length} stanzas...`);
stanzas.forEach((stanza, stanzaIndex) => {
  const combinedParts = [];
  console.log(
    `\nProcessing stanza ${stanzaIndex + 1} with ${stanza.length} lines`
  );

  for (let i = 0; i <= stanza.length - 1; i++) {
    const start = stanza[i].time;
    let end = stanza[i + 1]?.time;
    if (stanzaIndex == stanzas.length - 1 && i == stanza.length - 1) {
      // If last stanza and last line, use audio length as end time
      end = parseFloat(audioLength);
    } else if (i == stanza.length - 1) {
      // If last line of stanza, use next stanza's start time
      end = stanzas[stanzaIndex + 1][0].time;
    }

    const duration = (end - start).toFixed(2);
    console.log(
      `Processing stanza ${stanzaIndex + 1}, line ${
        i + 1
      }: start=${start}, end=${end}, duration=${duration} seconds`
    );

    const lineWav = `${outputDir}/stanza${stanzaIndex}_line${i}.wav`;
    const silenceWav = `${outputDir}/stanza${stanzaIndex}_silence${i}.wav`;
    const comboWav = `${outputDir}/stanza${stanzaIndex}_combo${i}.wav`;

    // Extract line as WAV
    execSync(
      `ffmpeg -loglevel quiet -y -i "${audioFile}" -ss ${start} -t ${duration} -acodec pcm_s16le -ar 44100 -ac 1 "${lineWav}"`
    );

    // Generate silence of same duration as WAV
    execSync(
      `ffmpeg -loglevel quiet -f lavfi -i anullsrc=r=44100:cl=mono -t ${duration} -acodec pcm_s16le "${silenceWav}"`
    );

    // Concatenate line + silence as WAV
    const listFile = `${outputDir}/concat_combo_${stanzaIndex}_${i}.txt`;
    fs.writeFileSync(
      listFile,
      [
        `file '${path.resolve(lineWav)}'`,
        `file '${path.resolve(silenceWav)}'`,
      ].join("\n")
    );

    execSync(
      `ffmpeg -loglevel quiet -y -f concat -safe 0 -i "${listFile}" -c copy "${comboWav}"`
    );

    combinedParts.push(comboWav);
  }

  // Final stanza concatenation
  const stanzaListFile = `${outputDir}/concat_stanza_${stanzaIndex}.txt`;
  fs.writeFileSync(
    stanzaListFile,
    combinedParts.map((f) => `file '${path.resolve(f)}'`).join("\n")
  );

  const finalWav = `${outputDir}/stanza_${stanzaIndex + 1}.wav`;
  const stanzaNumber = String(stanzaIndex + 1).padStart(2, "0");
  const firstLineText = stanzas[stanzaIndex][0].text;
  const finalMp3 = `${finalOutputDir}/${stanzaNumber}_${firstLineText}.mp3`;
  execSync(
    `ffmpeg -loglevel quiet -y -f concat -safe 0 -i "${stanzaListFile}" -c copy "${finalWav}"`
  );
  execSync(
    `ffmpeg -loglevel quiet -y -i "${finalWav}" -codec:a libmp3lame -qscale:a 2 "${finalMp3}"`
  );
  execSync(
    `ffmpeg -i "${finalMp3}" -metadata artist="Isha" -metadata album="Guru Pooja Call & Response" -metadata title="${firstLineText}" -metadata track="${
      stanzaIndex + 1
    }" -y temp.mp3 && mv temp.mp3 "${finalMp3}"`
  );

  console.log(`✅ Created ${finalMp3}`);
});
