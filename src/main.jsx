import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const ROUND_PLAN = [4, 4, 4, 5, 5, 5, 5, 6, 6, 6];
const MAX_GUESSES = 5;
const TIME_PER_GUESS = 20;
const CORRECT_REVEAL_DELAY_MS = 5500;
const MISS_REVEAL_DELAY_MS = 6000;
const TURKISH_LETTERS = 'abcçdefgğhıijklmnoöprsştuüvyz';
const REQUIRED_COUNTS = { 4: 3, 5: 4, 6: 3 };

function normalizeTurkish(input) {
  return input
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u');
}

function isCleanWord(word) {
  return [...word].every((letter) => TURKISH_LETTERS.includes(letter));
}

function normalizeWordForDictionary(raw, expectedLength) {
  if (typeof raw !== 'string') return null;
  const word = normalizeTurkish(raw.trim());
  if ([...word].length !== expectedLength) return null;
  if (!isCleanWord(word)) return null;
  return word;
}

function getBucket(wordsByLength, length) {
  return wordsByLength?.[String(length)] ?? wordsByLength?.[length] ?? [];
}

function readDictionaryPayload(payload) {
  const source = payload?.words ?? payload;
  const wordsByLength = {};

  for (const length of [4, 5, 6]) {
    const rawList = source?.[String(length)] ?? source?.[length];
    if (!Array.isArray(rawList)) {
      throw new Error(`${length} harfli kelime listesi bulunamadı.`);
    }

    const words = [...new Set(rawList
      .map((word) => normalizeWordForDictionary(word, length))
      .filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'tr-TR'));

    if (words.length < REQUIRED_COUNTS[length]) {
      throw new Error(`${length} harfli kelime listesi çok küçük: ${words.length}`);
    }

    wordsByLength[length] = words;
  }

  return {
    wordsByLength,
    meta: {
      source: payload?.source ?? 'public/tdk-words.json',
      generatedAt: payload?.generatedAt ?? null,
      counts: {
        4: wordsByLength[4].length,
        5: wordsByLength[5].length,
        6: wordsByLength[6].length
      }
    }
  };
}

function shuffle(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function pickRoundWords(wordsByLength) {
  const buckets = {
    4: shuffle(getBucket(wordsByLength, 4)),
    5: shuffle(getBucket(wordsByLength, 5)),
    6: shuffle(getBucket(wordsByLength, 6))
  };
  const cursors = { 4: 0, 5: 0, 6: 0 };

  return ROUND_PLAN.map((length) => {
    const word = buckets[length][cursors[length]];
    cursors[length] += 1;
    return word;
  }).filter(Boolean);
}

function evaluateGuess(guess, answer) {
  const result = Array(answer.length).fill('absent');
  const remainingLetters = new Map();

  [...answer].forEach((letter, index) => {
    if (guess[index] === letter) {
      result[index] = 'correct';
    } else {
      remainingLetters.set(letter, (remainingLetters.get(letter) ?? 0) + 1);
    }
  });

  [...guess].forEach((letter, index) => {
    if (result[index] === 'correct') return;
    const count = remainingLetters.get(letter) ?? 0;
    if (count > 0) {
      result[index] = 'present';
      remainingLetters.set(letter, count - 1);
    }
  });

  return result;
}

function useSoundEffects(enabled) {
  const audioContextRef = useRef(null);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    return audioContextRef.current;
  }, []);

  const unlockAudio = useCallback(() => {
    const context = ensureAudioContext();
    if (context?.state === 'suspended') {
      void context.resume();
    }
  }, [ensureAudioContext]);

  const playSound = useCallback((name) => {
    if (!enabled) return;
    const context = ensureAudioContext();
    if (!context) return;

    if (context.state === 'suspended') {
      void context.resume();
    }

    const sequences = {
      start: [
        [523.25, 0.00, 0.08, 'triangle', 0.055],
        [659.25, 0.09, 0.08, 'triangle', 0.055],
        [783.99, 0.18, 0.12, 'triangle', 0.06]
      ],
      guess: [
        [420, 0.00, 0.055, 'sine', 0.035]
      ],
      correct: [
        [523.25, 0.00, 0.08, 'triangle', 0.055],
        [783.99, 0.09, 0.10, 'triangle', 0.06],
        [1046.5, 0.20, 0.16, 'triangle', 0.065]
      ],
      invalid: [
        [220, 0.00, 0.09, 'sawtooth', 0.035],
        [185, 0.11, 0.12, 'sawtooth', 0.035]
      ],
      timeout: [
        [349.23, 0.00, 0.10, 'square', 0.03],
        [261.63, 0.13, 0.14, 'square', 0.03]
      ],
      tick: [
        [880, 0.00, 0.045, 'square', 0.025]
      ],
      miss: [
        [196, 0.00, 0.11, 'sawtooth', 0.035],
        [164.81, 0.13, 0.13, 'sawtooth', 0.035],
        [130.81, 0.28, 0.17, 'sawtooth', 0.035]
      ],
      next: [
        [392, 0.00, 0.07, 'sine', 0.04],
        [523.25, 0.09, 0.08, 'sine', 0.045]
      ],
      final: [
        [523.25, 0.00, 0.09, 'triangle', 0.05],
        [659.25, 0.11, 0.09, 'triangle', 0.05],
        [783.99, 0.22, 0.10, 'triangle', 0.055],
        [1046.5, 0.34, 0.18, 'triangle', 0.06]
      ]
    };

    const tones = sequences[name] ?? sequences.guess;
    const now = context.currentTime;

    tones.forEach(([frequency, offset, duration, type, volume]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + offset;
      const end = start + duration;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.03);
    });
  }, [enabled, ensureAudioContext]);

  return { playSound, unlockAudio };
}

function LetterTile({ letter = '', status = 'empty', locked = false }) {
  return (
    <div className={`tile ${status} ${locked ? 'locked' : ''}`}>
      {letter.toLocaleUpperCase('tr-TR')}
    </div>
  );
}

function GuessRow({ wordLength, guess, statuses, revealedFirstLetter, isActive, note }) {
  const letters = Array.from({ length: wordLength }, (_, index) => guess?.[index] ?? '');
  const computedStatuses = Array.from({ length: wordLength }, (_, index) => statuses?.[index] ?? 'empty');

  if (!guess && revealedFirstLetter) {
    letters[0] = revealedFirstLetter;
    computedStatuses[0] = 'clue';
  }

  const hasInvalid = computedStatuses.every((status) => status === 'invalid');

  return (
    <div className={`guess-row-wrap ${hasInvalid ? 'invalid-row' : ''}`}>
      <div className={`guess-row ${isActive ? 'active' : ''}`}>
        {letters.map((letter, index) => (
          <LetterTile
            key={index}
            letter={letter}
            status={computedStatuses[index]}
            locked={index === 0 && !!revealedFirstLetter && !guess}
          />
        ))}
      </div>
      {note ? <span className="row-note">{note}</span> : null}
    </div>
  );
}

function SetupPanel({ setupError }) {
  return (
    <section className="setup-panel">
      <p className="eyebrow">Kurulum gerekli</p>
      <h2>TDK kelime listesi yüklenemedi.</h2>
      <p>
        Oyun gerçek kelime havuzunu okumadan başlamıyor. Böylece eksik demo liste yüzünden
        normal kelimelerin “TDK listesinde yok” görünmesi engelleniyor.
      </p>
      {setupError ? <p className="error-text">Hata: {setupError}</p> : null}
      <div className="command-box">
        <code>npm run words</code>
        <code>npm run dev</code>
      </div>
    </section>
  );
}

function StartPanel({ loading, dictionaryMeta, totalCount, soundEnabled, onStart }) {
  if (loading) {
    return (
      <section className="start-panel">
        <p className="eyebrow">Hazırlanıyor</p>
        <h2>TDK kelime havuzu yükleniyor...</h2>
        <div className="loading-dots" aria-hidden="true"><span /><span /><span /></div>
      </section>
    );
  }

  return (
    <section className="start-panel">
      <p className="eyebrow">Hazır</p>
      <h2>Oyuna başlamaya hazır mısın?</h2>
      <p className="start-copy">
        Başlatmadan önce süre çalışmaz. Butona bastığında 10 turluk oyun başlar ve her kelimede ilk harf açık gelir.
      </p>

      <div className="rules-grid" aria-label="Oyun özeti">
        <div><strong>10</strong><span>tur</span></div>
        <div><strong>20 sn</strong><span>her tahmin</span></div>
        <div><strong>5</strong><span>hak</span></div>
        <div><strong>{soundEnabled ? 'Açık' : 'Kapalı'}</strong><span>ses</span></div>
      </div>

      <div className="word-plan">
        <span>3 × 4 harfli</span>
        <span>4 × 5 harfli</span>
        <span>3 × 6 harfli</span>
      </div>

      {dictionaryMeta ? (
        <p className="pool-line">
          Cevap havuzu hazır: {totalCount} kelime · {dictionaryMeta.counts[4]} adet 4 harfli · {dictionaryMeta.counts[5]} adet 5 harfli · {dictionaryMeta.counts[6]} adet 6 harfli
        </p>
      ) : null}

      <button className="primary-button big-start" onClick={onStart}>Oyuna Başla</button>
    </section>
  );
}

function RevealCard({ reveal, onSkip }) {
  if (!reveal) return null;

  return (
    <div className={`reveal-card ${reveal.tone}`} role="status" aria-live="polite">
      <span>{reveal.title}</span>
      <strong>{reveal.word.toLocaleUpperCase('tr-TR')}</strong>
      <p>{reveal.detail}</p>
      <button className="skip-reveal-button" type="button" onClick={onSkip}>Sıradaki kelimeye geç</button>
    </div>
  );
}

function App() {
  const [dictionary, setDictionary] = useState(null);
  const [answerDictionary, setAnswerDictionary] = useState(null);
  const [dictionaryMeta, setDictionaryMeta] = useState(null);
  const [setupError, setSetupError] = useState('');
  const [screen, setScreen] = useState('loading');
  const [roundWords, setRoundWords] = useState([]);
  const [roundResults, setRoundResults] = useState(() => Array(ROUND_PLAN.length).fill(null));
  const [roundIndex, setRoundIndex] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(TIME_PER_GUESS);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('TDK kelime havuzu yükleniyor...');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => window.localStorage.getItem('lingo-sound') !== 'off');
  const inputRef = useRef(null);
  const transitionTimeoutRef = useRef(null);
  const { playSound, unlockAudio } = useSoundEffects(soundEnabled);

  useEffect(() => {
    window.localStorage.setItem('lingo-sound', soundEnabled ? 'on' : 'off');
  }, [soundEnabled]);

  useEffect(() => {
    async function fetchWordFile(filename) {
      const url = `${import.meta.env.BASE_URL}${filename}`;
      const response = await fetch(url, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`${filename} bulunamadı. URL: ${url}`);
      }

      return response.json();
    }

    async function loadWords() {
      try {
        const [tdkPayload, commonPayload] = await Promise.all([
          fetchWordFile('tdk-words.json'),
          fetchWordFile('tdk-common-answers.json')
        ]);

        const tdk = readDictionaryPayload(tdkPayload);
        const common = readDictionaryPayload(commonPayload);

        setDictionary(tdk.wordsByLength);
        setAnswerDictionary(common.wordsByLength);
        setDictionaryMeta({
          ...common.meta,
          source: 'public/tdk-common-answers.json',
          validationCounts: tdk.meta.counts
        });

        setSetupError('');
        setScreen('ready');
        setMessage('Kolaylaştırılmış cevap havuzu hazır. Oyuna başlamak için butona bas.');
      } catch (error) {
        setDictionary(null);
        setAnswerDictionary(null);
        setDictionaryMeta(null);
        setRoundWords([]);
        setSetupError(error instanceof Error ? error.message : String(error));
        setMessage('Kelime listesi yüklenemedi.');
        setScreen('setup');
      }
    }

    loadWords();
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const answer = roundWords[roundIndex] ?? '';
  const wordLength = answer.length || ROUND_PLAN[roundIndex] || 4;
  const revealedFirstLetter = answer[0] ?? '';
  const validWords = useMemo(() => new Set(getBucket(dictionary, wordLength)), [dictionary, wordLength]);
  const totalCount = dictionaryMeta ? dictionaryMeta.counts[4] + dictionaryMeta.counts[5] + dictionaryMeta.counts[6] : 0;
  const gameOver = screen === 'gameOver';

  const resetGuessTimer = useCallback(() => setTimeLeft(TIME_PER_GUESS), []);

  const markRoundResult = useCallback((result) => {
    setRoundResults((previousResults) => {
      const nextResults = [...previousResults];
      nextResults[roundIndex] = result;
      return nextResults;
    });
  }, [roundIndex]);

  const clearTransitionTimeout = useCallback(() => {
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }, []);

  const advanceAfterReveal = useCallback(() => {
    clearTransitionTimeout();
    setReveal(null);
    setInput('');
    setGuesses([]);
    setTimeLeft(TIME_PER_GUESS);

    const nextIndex = roundIndex + 1;
    if (nextIndex >= ROUND_PLAN.length || nextIndex >= roundWords.length) {
      setScreen('gameOver');
      setMessage('Oyun bitti.');
      setIsTransitioning(false);
      playSound('final');
      return;
    }

    setRoundIndex(nextIndex);
    setMessage('Yeni kelime başladı. İlk harf açık.');
    setIsTransitioning(false);
    playSound('next');
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [clearTransitionTimeout, playSound, roundIndex, roundWords.length]);

  const finishRound = useCallback(({ tone, title, answerWord, detail, delay }) => {
    clearTransitionTimeout();
    setReveal({ tone, title, word: answerWord, detail });
    setIsTransitioning(true);
    setInput('');

    transitionTimeoutRef.current = window.setTimeout(() => {
      advanceAfterReveal();
    }, delay);
  }, [advanceAfterReveal, clearTransitionTimeout]);

  const startGame = useCallback(() => {
    if (!dictionary || !answerDictionary) return;

    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
    }

    const picked = pickRoundWords(answerDictionary);
    setRoundWords(picked);
    setRoundResults(Array(ROUND_PLAN.length).fill(null));
    setRoundIndex(0);
    setGuesses([]);
    setInput('');
    setTimeLeft(TIME_PER_GUESS);
    setScore(0);
    setMessage('Oyun başladı. İlk harf açık.');
    setScreen('playing');
    setIsTransitioning(false);
    setReveal(null);
    unlockAudio();
    playSound('start');
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [dictionary, answerDictionary, playSound, unlockAudio]);

  const submitGuess = useCallback((rawGuess, expired = false) => {
    if (!answer || screen !== 'playing' || setupError || isTransitioning) return;
    const normalized = normalizeTurkish(rawGuess.trim());
    let row;

    if (expired) {
      row = {
        text: ''.padEnd(wordLength, ' '),
        statuses: Array(wordLength).fill('invalid'),
        note: 'Süre doldu'
      };
    } else {
      if ([...normalized].length !== wordLength || !isCleanWord(normalized)) {
        setMessage(`${wordLength} harfli, yalnızca Türkçe harflerden oluşan bir kelime gir. Bu hak yanmadı.`);
        playSound('invalid');
        return;
      }

      if (!validWords.has(normalized)) {
        row = {
          text: normalized,
          statuses: Array(wordLength).fill('invalid'),
          note: 'TDK listesinde yok'
        };
      } else {
        row = {
          text: normalized,
          statuses: evaluateGuess(normalized, answer),
          note: ''
        };
      }
    }

    const nextGuesses = [...guesses, row];
    setGuesses(nextGuesses);
    setInput('');
    resetGuessTimer();

    if (!expired && normalized === answer) {
      setScore((previousScore) => previousScore + 1);
      markRoundResult('correct');
      setMessage(`Doğru! Kelime: ${answer.toLocaleUpperCase('tr-TR')}`);
      playSound('correct');
      finishRound({
        tone: 'success',
        title: 'Doğru bildin!',
        answerWord: answer,
        detail: 'Kelime biraz daha ekranda kalacak. Sonra yeni tura geçilecek.',
        delay: CORRECT_REVEAL_DELAY_MS
      });
      return;
    }

    if (nextGuesses.length >= MAX_GUESSES) {
      markRoundResult('miss');
      setMessage(`Bilemedin. Kelime: ${answer.toLocaleUpperCase('tr-TR')}`);
      playSound(expired ? 'timeout' : 'miss');
      finishRound({
        tone: 'miss',
        title: expired ? 'Süreyle birlikte hakların bitti' : 'Hakların bitti',
        answerWord: answer,
        detail: 'Doğru kelimeyi inceleyebilmen için geçiş biraz daha uzun.',
        delay: MISS_REVEAL_DELAY_MS
      });
      return;
    }

    if (expired) {
      setMessage(`Süre doldu. ${MAX_GUESSES - nextGuesses.length} hak kaldı.`);
      playSound('timeout');
    } else if (row.note) {
      setMessage(`${row.note}. Tahmin hakkı yandı. ${MAX_GUESSES - nextGuesses.length} hak kaldı.`);
      playSound('invalid');
    } else {
      setMessage(`${MAX_GUESSES - nextGuesses.length} hak kaldı.`);
      playSound('guess');
    }
  }, [answer, finishRound, guesses, isTransitioning, markRoundResult, playSound, resetGuessTimer, screen, setupError, validWords, wordLength]);

  useEffect(() => {
    if (!answer || screen !== 'playing' || setupError || isTransitioning) return undefined;
    const timer = window.setInterval(() => {
      setTimeLeft((previousTime) => {
        if (previousTime <= 1) {
          submitGuess('', true);
          return TIME_PER_GUESS;
        }
        return previousTime - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [answer, isTransitioning, screen, setupError, submitGuess]);

  useEffect(() => {
    if (screen === 'playing' && !isTransitioning && timeLeft > 0 && timeLeft <= 5) {
      playSound('tick');
    }
  }, [isTransitioning, playSound, screen, timeLeft]);

  function handleSubmit(event) {
    event.preventDefault();
    submitGuess(input, false);
  }

  function handleToggleSound() {
    setSoundEnabled((previousValue) => !previousValue);
    unlockAudio();
  }

  const rows = Array.from({ length: MAX_GUESSES }, (_, index) => guesses[index]);
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / TIME_PER_GUESS) * 100));
  const inputDisabled = screen !== 'playing' || !answer || !!setupError || isTransitioning;
  const remainingGuesses = Math.max(0, MAX_GUESSES - guesses.length);
  const correctCount = roundResults.filter((result) => result === 'correct').length;
  const missCount = roundResults.filter((result) => result === 'miss').length;

  function getRoundClass(index) {
    if (roundResults[index] === 'correct') return 'success';
    if (roundResults[index] === 'miss') return 'miss';
    if (screen === 'playing' && index === roundIndex) return 'current';
    return '';
  }

  return (
    <main className="page-shell">
      <section className="studio-card">
        <header className="topbar">
          <div>
            <p className="eyebrow">TDK LİNGO</p>
            <h1>Lingo Türkiye</h1>
          </div>
          <div className="top-actions">
            <button className="sound-button" type="button" onClick={handleToggleSound} aria-label="Sesi aç veya kapat">
              {soundEnabled ? '🔊 Ses' : '🔇 Sessiz'}
            </button>
            <div className="score-box">
              <span>Skor</span>
              <strong>{score}/{ROUND_PLAN.length}</strong>
            </div>
          </div>
        </header>

        <div className="round-strip" aria-label="Tur ilerlemesi">
          {ROUND_PLAN.map((length, index) => (
            <span key={index} className={getRoundClass(index)} title={`${index + 1}. tur: ${length} harf`}>
              {length}
            </span>
          ))}
        </div>

        {setupError ? (
          <SetupPanel setupError={setupError} />
        ) : screen === 'loading' || screen === 'ready' ? (
          <StartPanel
            loading={screen === 'loading'}
            dictionaryMeta={dictionaryMeta}
            totalCount={totalCount}
            soundEnabled={soundEnabled}
            onStart={startGame}
          />
        ) : screen === 'playing' ? (
          <>
            <div className="stage-banner">
              <div>
                <span className="small-label">Tur {Math.min(roundIndex + 1, ROUND_PLAN.length)} / {ROUND_PLAN.length}</span>
                <h2>{wordLength} harfli kelime</h2>
                <p className="meta-line">
                  İlk harf: <strong>{revealedFirstLetter.toLocaleUpperCase('tr-TR')}</strong> · Kalan hak: <strong>{remainingGuesses}</strong>
                </p>
              </div>
              <div className={`timer ${timeLeft <= 5 && !isTransitioning ? 'warning' : ''}`} aria-label="Kalan süre">
                <svg viewBox="0 0 36 36">
                  <path className="timer-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="timer-fill" strokeDasharray={`${progressPercent}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <strong>{isTransitioning ? '••' : timeLeft}</strong>
              </div>
            </div>

            <section className="board" aria-label="Tahmin tahtası">
              {rows.map((guess, index) => (
                <GuessRow
                  key={`${roundIndex}-${index}`}
                  wordLength={wordLength}
                  guess={guess?.text}
                  statuses={guess?.statuses}
                  note={guess?.note}
                  revealedFirstLetter={index === guesses.length && !isTransitioning ? revealedFirstLetter : ''}
                  isActive={index === guesses.length && !isTransitioning}
                />
              ))}
            </section>

            <RevealCard reveal={reveal} onSkip={advanceAfterReveal} />

            <form className="guess-form" onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                value={input}
                autoFocus
                maxLength={wordLength}
                disabled={inputDisabled}
                placeholder={`${wordLength} harfli tahmin`}
                onChange={(event) => setInput(normalizeTurkish(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setInput('');
                }}
              />
              <button type="submit" disabled={inputDisabled}>Tahmin Et</button>
            </form>
            <p className="message">{message}</p>
            <p className="helper-line">
              <span>{[...input].length}/{wordLength} harf</span> · Enter ile gönder · Esc ile temizle · TDK dışı kelimede satır kırmızı olur ve hak yanar.
            </p>
          </>
        ) : gameOver ? (
          <section className="game-over">
            <p className="eyebrow">Final</p>
            <h2>Skorun: {score}</h2>
            <p>Toplam doğru bilinen kelime sayısı skor olarak alındı.</p>
            <div className="final-summary">
              <span><strong>{correctCount}</strong> doğru</span>
              <span><strong>{missCount}</strong> kaçan</span>
              <span><strong>{ROUND_PLAN.length}</strong> toplam tur</span>
            </div>
            <button className="primary-button" onClick={startGame}>Yeni oyun başlat</button>
          </section>
        ) : null}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
