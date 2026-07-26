# Game sounds

Drop audio files here with the **exact names below** and they take over
automatically on the next page load — no code change.

**Any of `.mp3`, `.wav`, `.ogg` or `.m4a` works.** Use whatever you found — there
is no need to convert. Just match the name: `buzzed.wav` and `buzzed` are
equally fine. (If both exist, `.mp3` wins, purely because it's smaller.)

Every cue already has a synthesised fallback, so the game makes sense with this
folder empty. Missing files are not an error; you can add them one at a time.

Some cues also **borrow** a neighbour's recording when they have no file of
their own, so you don't have to source all sixteen. A real file always wins —
drop `join.wav` in and it stops borrowing.

| Cue | Borrows from | Why |
| --- | --- | --- |
| `login-success` | `locked-in` | "You're signed in" and "your answer landed" are the same reassurance. |
| `login-error` | `lock` | The closest thing to a "no" in the set. |
| `join` | `reveal` | Joining deserves the bright resolving chime. |
| `oracle-reveal` | `winner` | The Oracle naming someone earns the fanfare. |

## What to get

The TV plays through the church PA, so its cues should be **broadcast-quality
and short**. Phone cues should be **dry and tiny** — 500 phones playing a
fanfare would fight the PA rather than support it.

| Name | Plays on | When | What to look for |
| --- | --- | --- | --- |
| `buzzed` | TV + phone | Someone hits the buzzer | The classic quiz-show **BZZZT**. Short, punchy, unmistakable. The single most important file here. |
| `buzzer-open` | TV | Host opens the buzzer | A start gun / "GO" sting. Should make heads snap up. |
| `round-start` | TV | A trivia question appears | Game-show question whoosh or riser. Under 1s. |
| `tick` | TV | Each of the last 10 seconds | A single clock tick. Dry, no reverb. |
| `tick-urgent` | TV | Each of the last 5 seconds | Same clock, higher and tighter. |
| `lock` | TV | Answers close | "Time's up" — a low horn or thud. |
| `reveal` | TV | Correct answer shown | Bright resolving chime. Celebratory, not a fanfare. |
| `call` | TV | A bingo item is called | A bell or ding. Reads as *listen*, not *well done*. |
| `bingo-win` | TV + phone | Someone gets bingo | Short celebration. It will fire repeatedly as more people win, so keep it under 1.5s. |
| `winner` | TV | Final standings | The one place a proper fanfare belongs. Up to 3s. |
| `tap` | Phone | Any tap | A UI click. Barely there. |
| `locked-in` | Phone | Answer accepted | A soft two-note confirm. |
| `spin` | Oracle TV | While the reels turn | **Must loop cleanly** — it's played on repeat for the whole spin. A slot-machine whirr or reel clicks. |
| `spin-land` | Oracle TV | The reels stop | A mechanical clunk as the number lands. |
| `oracle-reveal` | Oracle TV | The winner's name appears | A short reveal sting. |
| `login-success` | Phone | Signed in | Two soft notes. |
| `login-error` | Phone | Sign-in failed | A gentle descending pair. Not harsh — people mistype. |
| `join` | Phone | Joined the game with an Oracle ID | A small rising flourish. |

## Where to get them

All of these have sounds usable without attribution — check the licence on the
individual file before downloading:

- **Pixabay** — <https://pixabay.com/sound-effects/search/game%20show/> — free
  for commercial use, no attribution. The easiest starting point.
- **Mixkit** — <https://mixkit.co/free-sound-effects/game-show/> — free, no
  attribution required.
- **Freesound** — <https://freesound.org/search/?f=license:%22Creative+Commons+0%22>
  — filter to **CC0** to avoid attribution obligations.

Search terms that land well: *quiz buzzer*, *game show buzzer*, *game show
correct*, *countdown tick*, *bingo bell*, *fanfare short*, *ui click*.

## Practical notes

- **Mono is plenty**, and MP3 at ~128kbps keeps the download small — worth it on
  the venue's connection. WAV files are much larger; fine for a handful, less so
  for all sixteen. These are fetched once and cached.
- **Trim the silence** off the front of every file. Leading silence on
  `buzzed` becomes visible lag on a race that's decided in milliseconds.
- **Keep them short.** Anything over ~2s will still be playing when the next
  thing happens. The exception is `spin`, which is meant to repeat.
- **`spin` must loop seamlessly.** Trim it to a whole number of reel clicks
  with no silence at either end, or you'll hear a gap on every repeat.
- Levels are normalised in code (`CUE_FILES` in `src/lib/audio/sound.ts`), so
  don't worry about matching volumes by hand — but do adjust the `gain` there if
  something sits wrong in the room.
- After adding files, open `/games` on the TV, press **Tap anywhere to turn on
  sound**, and check the sound desk level before the hall fills up.
