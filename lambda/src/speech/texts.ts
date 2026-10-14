/**
 * The fixed texts the skill says itself. Everything else comes from the API.
 * Tone: informal „du“, warm, calm, short (docs/STYLE-AND-TONE.md in the main repo).
 */
export const T = {
  unlinked:
    'Um das Jahresrad zu nutzen, verbinde den Skill bitte in der Alexa-App mit deinem Gefährten-Konto auf naturgarten.bio.',
  notCompanion: 'Dein Konto hat derzeit keinen Gefährten-Zugang. Mehr dazu findest du auf naturgarten.bio.',
  notCompanionCard: 'Dein Konto hat derzeit keinen Gefährten-Zugang. Mehr dazu findest du auf https://naturgarten.bio',
  unavailable: 'Das Jahresrad ist gerade nicht erreichbar. Bitte versuch es später noch einmal.',
  stale: 'Das Jahresrad ist gerade nicht erreichbar. Hier ist der Stand von heute früh.',
  failed: 'Da ist leider etwas schiefgegangen. Bitte versuch es noch einmal.',
  goodbye: 'Bis bald im Garten!',
  welcome: 'Willkommen beim Jahresrad von naturgarten.bio.',
  help:
    'Ich erzähle dir, wo wir im Jahreskreis stehen: Naturjahreszeit, Mond, Sonne, das nächste Fest und was im Garten zu tun ist. ' +
    'Frag zum Beispiel: Wann ist das nächste Fest? Wie steht der Mond? Oder: Was ist heute im Garten zu tun?',
  helpQuestion: 'Was möchtest du wissen?',
  fallback: 'Das habe ich leider nicht verstanden. Du kannst zum Beispiel fragen: Wie steht der Mond?',
  anythingElse: 'Möchtest du noch etwas wissen?',
  reprompt: 'Frag mich zum Beispiel nach dem Mond, dem nächsten Fest oder den Gartenarbeiten der Woche.',
  whatThen: 'Was möchtest du wissen? Zum Beispiel etwas über das nächste Fest, den Mond oder die Gartenarbeiten der Woche.',
  whichFestival: 'Welches Fest meinst du? Zum Beispiel Samhain, Yule oder Imbolc.',
  readOn: 'Soll ich weiterlesen?',
  moreCustoms: 'Soll ich dir mehr über das Brauchtum erzählen?',
  okay: 'Alles klar.',
  moonNote: 'Das ist alte Gartenweisheit, keine Wissenschaft: Boden und Wetter gehen vor.',
  locationHint: (label: string) =>
    `Ich rechne gerade mit ${label} als Ort. Wenn du in deinem Profil auf naturgarten.bio deinen Garten einträgst, stimmen Sonnenzeiten und Jahreszeiten genauer.`,
  locationCardTitle: 'Dein Ort im Jahresrad',
  locationCard: (label: string) =>
    `Das Jahresrad rechnet gerade mit ${label}. Trag in deinem Profil deinen Garten oder dein Zuhause ein, dann stimmen Sonnenzeiten und Naturjahreszeiten für deinen Ort: https://naturgarten.bio/profil`,
};
