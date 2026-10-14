import { beforeEach, describe, expect, it } from 'vitest';
import type { Task, Week } from '../src/api/types';
import { T } from '../src/speech/texts';
import { directive, envelope, fixture, intent, launch, said, setup, USER, userEvent } from './helpers';

let t: ReturnType<typeof setup>;
beforeEach(() => {
  t = setup();
});

describe('daily briefing', () => {
  it('launch: welcome, the API briefing, the location hint once, then a question', async () => {
    const res = await t.invoke(envelope(launch(), { apl: true }));
    const text = said(res);
    expect(text).toContain(T.welcome);
    expect(text).toContain(fixture<{ summary: { speech: string } }>('today').summary.speech);
    expect(text).toContain('Ich rechne gerade mit Klagenfurt als Ort.');
    expect(text).toContain('Möchtest du mehr über Samhain, den Mond oder die Gartenarbeiten der Woche hören?');
    expect(res.response.shouldEndSession).toBe(false);
    expect(res.sessionAttributes?.pending).toEqual({ type: 'launchMenu' });
    expect(res.response.card).toMatchObject({ type: 'Simple', title: T.locationCardTitle });
    expect(directive(res)?.token).toBe('mainScreen');

    const again = await t.invoke(envelope(launch(), { apl: true }));
    expect(said(again)).not.toContain(T.welcome);
    expect(said(again)).not.toContain('Ich rechne gerade mit');
    expect(again.response.card).toBeUndefined();
  });

  it('asks the API with the device time zone', async () => {
    await t.invoke(envelope(intent('TodayIntent')));
    expect(t.api.calls[0]).toMatchObject({ path: '/today', query: { tz: 'Europe/Vienna' } });
    expect(t.api.calls[0]!.headers.Authorization).toMatch(/^Bearer /);
  });

  it('one-shot: answers and ends; on a screen the session end is left open for the display', async () => {
    const voice = await t.invoke(envelope(intent('TodayIntent')));
    expect(voice.response.shouldEndSession).toBe(true);
    expect(said(voice)).not.toContain(T.anythingElse);
    const screen = await t.invoke(envelope(intent('TodayIntent'), { apl: true }));
    expect(screen.response.shouldEndSession).toBeUndefined();
    expect(directive(screen)).toBeDefined();
  });

  it('inside a conversation: answers and asks whether there is more', async () => {
    const res = await t.invoke(envelope(intent('TodayIntent'), { newSession: false }));
    expect(said(res).endsWith(T.anythingElse)).toBe(true);
    expect(res.response.shouldEndSession).toBe(false);
    expect(res.response.reprompt).toBeDefined();
  });

  it('a specific date reads the API briefing for that day', async () => {
    const res = await t.invoke(envelope(intent('DayIntent', { date: { value: '2026-12-21' } })));
    expect(said(res)).toContain('Montag, 21. Dezember. An diesem Tag feiern wir Yule');
    expect(t.api.calls.at(-1)?.path).toBe('/day/2026-12-21');
  });

  it('a date outside this year ±1 is refused with a question', async () => {
    const res = await t.invoke(envelope(intent('DayIntent', { date: { value: '2030-05-01' } })));
    expect(said(res)).toContain('Ich kann Tage von 2025 bis 2027 nachschlagen.');
    expect(t.api.calls).toHaveLength(0);
    expect(res.response.shouldEndSession).toBe(false);
  });
});

describe('festivals', () => {
  it('next festival: the API sentence, then the offer to tell more', async () => {
    const res = await t.invoke(envelope(intent('NextFestivalIntent'), { apl: true }));
    expect(said(res)).toBe(
      'Das nächste Fest ist Samhain am Montag, 9. November, in 26 Tagen. Das Fest der Ahnen und des Übergangs. Soll ich dir mehr über das Brauchtum erzählen?',
    );
    expect(directive(res)?.token).toBe('festivalScreen');

    const more = await t.invoke(envelope(intent('AMAZON.YesIntent'), { newSession: false, attributes: res.sessionAttributes }));
    expect(said(more)).toContain('Die Ähre ist abgestorben, das Samenkorn fällt auf die Erde und schläft. Der neue Zyklus beginnt.');
    expect(said(more)).toContain('Impulse zum Nachspüren: Was brauche ich nicht mehr');
  });

  it('a festival already past this year also names next year’s date', async () => {
    const res = await t.invoke(envelope(intent('FestivalInfoIntent', { festival: { value: 'Lichtmess', id: 'imbolc' } })));
    const text = said(res);
    expect(text).toContain('Imbolc war dieses Jahr am Sonntag, 1. Februar.');
    expect(text).toContain('Nächstes Jahr ist es am Freitag, 22. Januar, in 100 Tagen.');
  });

  it('an upcoming festival: date and countdown', async () => {
    const res = await t.invoke(envelope(intent('FestivalInfoIntent', { festival: { value: 'Jul', id: 'yule' } })));
    expect(said(res)).toContain('Yule ist am Montag, 21. Dezember, in 68 Tagen.');
  });

  it('matches spellings without entity resolution', async () => {
    const res = await t.invoke(envelope(intent('FestivalInfoIntent', { festival: { value: 'Beltaine' } })));
    expect(said(res)).toContain('Beltane war dieses Jahr am');
  });

  it('asks back when the festival is missing', async () => {
    const res = await t.invoke(envelope(intent('FestivalInfoIntent', { festival: {} })));
    expect(said(res)).toBe(T.whichFestival);
    expect(res.response.shouldEndSession).toBe(false);
    expect(res.sessionAttributes?.pending).toEqual({ type: 'whichFestival' });
  });
});

describe('moon', () => {
  it('current phase and the next change', async () => {
    const res = await t.invoke(envelope(intent('MoonIntent', { moonEvent: {} }), { apl: true }));
    expect(said(res)).toBe('Heute: Zunehmende Sichel, zu 14 Prozent beleuchtet. Erstes Viertel ist am Sonntag, 18. Oktober.');
    expect(directive(res)?.token).toBe('moonScreen');
  });

  it('full moon and new moon answer the date directly', async () => {
    const full = await t.invoke(envelope(intent('MoonIntent', { moonEvent: { value: 'Vollmond', id: 'full_moon' } })));
    expect(said(full)).toBe('Der nächste Vollmond ist am Montag, 26. Oktober.');
    const neu = await t.invoke(envelope(intent('MoonIntent', { moonEvent: { value: 'Neumond', id: 'new_moon' } })));
    expect(said(neu)).toBe('Der nächste Schwarzmond, also Neumond, ist am Montag, 9. November.');
  });

  it('gardening with the moon: rhythm, and when the path turns', async () => {
    const res = await t.invoke(envelope(intent('MoonGardenIntent')));
    expect(said(res)).toBe('Der Mond nimmt zu und sinkt. Ab Freitag steigt der Mond.');
  });

  it('gardening with the moon: tips come with the note that it is old wisdom', async () => {
    t.api.data.set('today', fixture('day-2026-05-20'));
    const res = await t.invoke(envelope(intent('MoonGardenIntent')));
    expect(said(res)).toContain('nach alter Gartenregel gut zum Auspflanzen von Jungpflanzen.');
    expect(said(res)).toContain('Alte Gartenweisheit, keine Wissenschaft');
  });
});

describe('sun, season, garden', () => {
  it('daylight names the default place', async () => {
    const res = await t.invoke(envelope(intent('DaylightIntent')));
    expect(said(res)).toBe(
      'In Klagenfurt geht die Sonne um 7 Uhr 19 auf und um 18 Uhr 18 unter. Es ist 10 Stunden und 59 Minuten hell. Die Tage werden um 4 Minuten kürzer.',
    );
  });

  it('season with its signs and the next one', async () => {
    const res = await t.invoke(envelope(intent('SeasonIntent')));
    expect(said(res)).toBe(
      'In der Natur ist Vollherbst, seit dem 8. September. Typische Zeichen: Eicheln reif und Rosskastanien reif. Etwa ab Mittwoch, 28. Oktober beginnt der Spätherbst.',
    );
  });

  it('garden today: up to three tasks', async () => {
    const res = await t.invoke(envelope(intent('GardenTodayIntent'), { apl: true }));
    expect(said(res)).toBe(
      'Im Vollherbst steht an: Gehölze und Stauden pflanzen, der Boden ist noch warm. Zwiebeln der Frühblüher setzen. Mulchschicht erneuern.',
    );
    expect(directive(res)?.token).toBe('gardenScreen');
  });

  it('garden week: five at a time, grouped by season, „Soll ich weiterlesen?“', async () => {
    const week = fixture<Week>('week');
    const late: Task[] = ['Laub liegen lassen', 'Totholzhaufen anlegen', 'Samenstände stehen lassen', 'Mulchen statt umgraben'].map((title, i) => ({
      id: `lateAutumn-${i + 1}`,
      title,
      speech: `${title}.`,
    }));
    week.days[3]!.season = { id: 'lateAutumn', name: 'Spätherbst', starts_today: true };
    for (const d of week.days.slice(4)) d.season = { id: 'lateAutumn', name: 'Spätherbst', starts_today: false };
    week.garden.tasks = [...week.garden.tasks, ...late];
    t.api.data.set('week', week);

    const first = await t.invoke(envelope(intent('GardenWeekIntent'), { newSession: false }));
    expect(said(first)).toBe(
      'Diese Woche im Garten. Im Vollherbst: Gehölze und Stauden pflanzen, der Boden ist noch warm. Zwiebeln der Frühblüher setzen. Mulchschicht erneuern. ' +
        'Ab Samstag ist Spätherbst: Laub liegen lassen. Totholzhaufen anlegen. Soll ich weiterlesen?',
    );
    expect(first.sessionAttributes?.pending).toEqual({ type: 'gardenWeekMore', start: '2026-10-14', offset: 5 });

    const rest = await t.invoke(envelope(intent('AMAZON.YesIntent'), { newSession: false, attributes: first.sessionAttributes }));
    expect(said(rest)).toMatch(/^Weiter\. Ab Samstag ist Spätherbst: Samenstände stehen lassen\. Mulchen statt umgraben\./);
    expect(rest.sessionAttributes?.pending).toEqual({ type: 'anythingElse' });
  });
});

describe('built-in intents', () => {
  it('help explains with examples and shows the help screen', async () => {
    const res = await t.invoke(envelope(intent('AMAZON.HelpIntent'), { apl: true }));
    expect(said(res)).toContain('Frag zum Beispiel: Wann ist das nächste Fest?');
    expect(res.response.shouldEndSession).toBe(false);
    expect(directive(res)?.token).toBe('helpScreen');
  });

  it('stop says goodbye and ends', async () => {
    const res = await t.invoke(envelope(intent('AMAZON.StopIntent'), { newSession: false }));
    expect(said(res)).toBe(T.goodbye);
    expect(res.response.shouldEndSession).toBe(true);
  });

  it('fallback: once the hint, twice the help', async () => {
    const one = await t.invoke(envelope(intent('AMAZON.FallbackIntent'), { newSession: false }));
    expect(said(one)).toBe(T.fallback);
    expect(one.response.shouldEndSession).toBe(false);
    const two = await t.invoke(envelope(intent('AMAZON.FallbackIntent'), { newSession: false, attributes: one.sessionAttributes }));
    expect(said(two)).toContain(T.help);
  });

  it('yes without a question is taken kindly and asks what next', async () => {
    const res = await t.invoke(envelope(intent('AMAZON.YesIntent'), { newSession: false }));
    expect(said(res)).toBe(`${T.gladly} ${T.whatThen}`);
    expect(res.response.shouldEndSession).toBe(false);
    expect(res.response.reprompt).toBeDefined();
  });

  it('no without a question ends kindly', async () => {
    const res = await t.invoke(envelope(intent('AMAZON.NoIntent'), { newSession: false }));
    expect(said(res)).toBe(`${T.okay} ${T.goodbye}`);
    expect(res.response.shouldEndSession).toBe(true);
  });

  it('no after a question ends kindly', async () => {
    const res = await t.invoke(envelope(intent('AMAZON.NoIntent'), { newSession: false, attributes: { pending: { type: 'anythingElse' } } }));
    expect(said(res)).toBe(`${T.okay} ${T.goodbye}`);
    expect(res.response.shouldEndSession).toBe(true);
  });

  it('yes after the launch question asks what exactly', async () => {
    const res = await t.invoke(envelope(intent('AMAZON.YesIntent'), { newSession: false, attributes: { pending: { type: 'launchMenu' } } }));
    expect(said(res)).toBe(T.whatThen);
  });

  it('navigate home shows the main screen', async () => {
    const res = await t.invoke(envelope(intent('AMAZON.NavigateHomeIntent'), { apl: true, newSession: false }));
    expect(directive(res)?.token).toBe('mainScreen');
  });
});

describe('touch and events', () => {
  it('a tap on the moon card answers like the intent and does not reopen the microphone', async () => {
    const res = await t.invoke(envelope(userEvent('nav', 'moon'), { apl: true, newSession: false }));
    expect(said(res)).toContain('Zunehmende Sichel');
    expect(directive(res)?.token).toBe('moonScreen');
    expect(res.response.shouldEndSession).toBeUndefined();
    expect(res.response.reprompt).toBeUndefined();
  });

  it('a tap on a task reads it', async () => {
    const res = await t.invoke(envelope(userEvent('nav', 'task', 'fullAutumn-2'), { apl: true, newSession: false }));
    expect(said(res)).toBe('Zwiebeln der Frühblüher setzen.');
  });

  it('help chips work like the spoken question', async () => {
    const res = await t.invoke(envelope(userEvent('nav', 'say', 'imbolc'), { apl: true, newSession: false }));
    expect(said(res)).toContain('Imbolc war dieses Jahr');
  });

  it('disabling the skill forgets the user', async () => {
    await t.invoke(envelope(launch()));
    expect(t.adapter.store.get(USER)).toMatchObject({ seen: true, locationHintGiven: true });
    await t.invoke(envelope({ type: 'AlexaSkillEvent.SkillDisabled', body: { userInformationPersistenceStatus: 'NOT_PERSISTED' } }));
    expect(t.adapter.store.has(USER)).toBe(false);
  });
});

describe('every answer is clean', () => {
  const requests = [
    launch(),
    intent('TodayIntent'),
    intent('NextFestivalIntent'),
    intent('FestivalInfoIntent', { festival: { value: 'Samhain', id: 'samhain' } }),
    intent('MoonIntent', { moonEvent: {} }),
    intent('MoonGardenIntent'),
    intent('DaylightIntent'),
    intent('GardenTodayIntent'),
    intent('GardenWeekIntent'),
    intent('SeasonIntent'),
    intent('DayIntent', { date: { value: '2026-12-21' } }),
    intent('AMAZON.HelpIntent'),
  ];
  for (const request of requests) {
    const name = (request as { intent?: { name: string } }).intent?.name ?? request.type;
    it(`${name}: no null, undefined or NaN, spoken or shown`, async () => {
      for (const viewport of [{ w: 1280, h: 800 }, { w: 960, h: 480 }, { w: 1080, h: 1920 }]) {
        const res = await t.invoke(envelope(request, { apl: true, viewport }));
        const text = said(res);
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/\b(null|undefined|NaN)\b|\[object/);
        expect(JSON.stringify(directive(res)?.document ?? {})).not.toMatch(/\b(undefined|NaN)\b|\[object/);
      }
    });
  }
});
