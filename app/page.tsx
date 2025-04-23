"use client";

/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

import { useState, useEffect, useRef } from "react"; // useRef を追加
import useSound from "use-sound";
import { useWindowSize } from "react-use";
import HomeScreen from "../components/HomeScreen"; // 追加
import QuizListScreen from "../components/QuizListScreen"; // 追加
import GameScreen from "../components/GameScreen"; // 追加
import ResultsScreen from "../components/ResultsScreen"; // 追加
import HintModal from "../components/HintModal"; // HintModal をインポート

// 謎解きのデータ型定義 (エクスポート)
export interface Question {
  question: string;
  imageUrl?: string;
  answers: string[];
  hint?: string;
  explanation?: string;
}

export interface QuizData {
  [key: number]: Question[];
}

// 謎解きデータ取得用フック
function useQuizData() {
  const [quizData, setQuizData] = useState<QuizData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/quiz")
      .then((res) => {
        if (!res.ok) throw new Error("API Error");
        return res.json();
      })
      .then((data) => {
        setQuizData(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return { quizData, loading, error };
}

const stageNames = ["謎レベル１", "謎レベル２", "謎レベル３", "謎レベル４"];

// LocalStorageのキー
const COMPLETED_STAGES_KEY = "riddlemaster_completed_stages";

export default function Home() {
  const { width, height } = useWindowSize();
  const [currentStage, setCurrentStage] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "correct" | "incorrect" | "";
  }>({ message: "", type: "" });
  const [isAnswered, setIsAnswered] = useState(false); // 正解したかどうか
  const [showHint, setShowHint] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // 経過時間
  const [timerActive, setTimerActive] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [answers, setAnswers] = useState<
    {
      question: string;
      isCorrect: boolean;
      userAnswer: string;
      correctAnswer: string;
    }[]
  >([]);
  const [attemptCount, setAttemptCount] = useState(0); // 回答試行回数
  const [completedStages, setCompletedStages] = useState<number[]>([]); // クリア済みステージ

  // 画面表示状態
  const [screen, setScreen] = useState<
    "home" | "quiz-list" | "game" | "results"
  >("home");

  const { quizData, loading, error } = useQuizData();
  const questions = currentStage ? quizData[currentStage] || [] : [];
  const currentQuestion = questions[currentQuestionIndex];

  const sounds = {
    phone: useSound("/sounds/phone.mp3", {
      volume: 0.02,
      playbackRate: 0.75,
    })[0],
    success: useSound("/sounds/success.mp3", {
      volume: 0.02,
      playbackRate: 0.75,
    })[0],
    correct: useSound("/sounds/correct.mp3", {
      volume: 0.02,
      playbackRate: 0.75,
    })[0],
    incorrect: useSound("/sounds/incorrect.mp3", {
      volume: 0.02,
      playbackRate: 0.75,
    })[0],
    cursor: useSound("/sounds/sound01.mp3", {
      volume: 0.02,
      playbackRate: 0.75,
    })[0],
  };

  // LocalStorageからクリア済みステージを読み込む
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedStages = localStorage.getItem(COMPLETED_STAGES_KEY);
        if (savedStages) {
          setCompletedStages(JSON.parse(savedStages));
        }
      } catch (e) {
        console.error("Failed to load completed stages from LocalStorage", e);
      }
    }
  }, []);

  // クリア済みステージをLocalStorageに保存
  const saveCompletedStages = (stages: number[]) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(COMPLETED_STAGES_KEY, JSON.stringify(stages));
      } catch (e) {
        console.error("Failed to save completed stages to LocalStorage", e);
      }
    }
  };

  // 経過時間計測用のタイマー
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (timerActive) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [timerActive]);

  const handleStageSelect = (stage: number) => {
    sounds.phone();
    setCurrentStage(stage);
    setCurrentQuestionIndex(0);
    setUserAnswer("");
    setFeedback({ message: "", type: "" });
    setIsAnswered(false);
    setShowHint(false);
    setAnswers([]);
    setScreen("game");
    setShowResults(false);
    setStartTime(Date.now());
    setElapsedTime(0);
    setAttemptCount(0);

    // タイマー開始
    setTimerActive(true);
  };

  // この handleAnswerSubmit は後で修正されたものに置き換えられるため削除
  // const handleAnswerSubmit = (e: React.FormEvent<HTMLFormElement>) => { ... };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      sounds.phone();
      setCurrentQuestionIndex((prev) => prev + 1);
      setUserAnswer("");
      setFeedback({ message: "", type: "" });
      setIsAnswered(false);
      setShowHint(false);
      setAttemptCount(0);

      // 問題が変わったら時間をリセットして再開
      setElapsedTime(0);
      setTimerActive(true);
    } else {
      // 謎解き完了時
      sounds.success();
      setEndTime(Date.now());
      setShowResults(true);
      setScreen("results");
      setTimerActive(false);

      // 全問題クリアした場合、ステージをクリア済みとして記録
      if (
        currentStage &&
        correctAnswersCount === questions.length &&
        !completedStages.includes(currentStage)
      ) {
        const newCompletedStages = [...completedStages, currentStage];
        setCompletedStages(newCompletedStages);
        saveCompletedStages(newCompletedStages);
      }
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      setUserAnswer("");
      setFeedback({ message: "", type: "" });
      setIsAnswered(false);
      setShowHint(false);
      setAttemptCount(0);
    }
  };

  const handleReturnToSelection = () => {
    sounds.phone();
    setCurrentStage(null);
    setCurrentQuestionIndex(0);
    setUserAnswer("");
    setFeedback({ message: "", type: "" });
    setIsAnswered(false);
    setShowHint(false);
    setShowResults(false);
    setAnswers([]);
    setScreen("quiz-list");
    setTimerActive(false);
  };

  const handleHintToggle = () => {
    setShowModal(!showModal);
    setShowHint(!showHint);
  };

  const handleRetry = () => {
    // 現在のステージを再度プレイ
    sounds.phone();
    setCurrentQuestionIndex(0);
    setUserAnswer("");
    setFeedback({ message: "", type: "" });
    setIsAnswered(false);
    setShowHint(false);
    setShowResults(false);
    setAnswers([]);
    setStartTime(Date.now());
    setEndTime(null);
    setScreen("game");
    setElapsedTime(0);
    setAttemptCount(0);

    // タイマー開始
    setTimerActive(true);
  };

  // 正解数の計算
  const correctAnswersCount = answers.filter(
    (answer) => answer.isCorrect
  ).length;

  // 経過時間の計算（秒）
  const totalTime =
    startTime && endTime
      ? Math.floor((endTime - startTime) / 1000)
      : elapsedTime;

  // スコアのパーセンテージ計算
  const scorePercentage =
    questions.length > 0
      ? Math.round((correctAnswersCount / questions.length) * 100)
      : 0;

  // 分と秒に整形する関数
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" + secs : secs}`;
  };

  // スクロール用のref
  const mainContentRef = useRef<HTMLDivElement>(null);

  // 正解時にスクロールする関数
  const scrollToBottom = () => {
    mainContentRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
    // window.scrollTo({
    //   top: document.documentElement.scrollHeight,
    //   behavior: 'smooth'
    // });
  };

  // handleAnswerSubmit 内で正解時に scrollToBottom を呼び出すように修正
  const handleAnswerSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentQuestion) return;

    // 回答試行回数を増やす
    setAttemptCount((prev) => prev + 1);

    const correctAnswers = currentQuestion.answers;
    const userAnswerTrimmed = userAnswer.trim();

    // 正誤判定（単語が含まれているかチェック）
    const isCorrect = correctAnswers.some((ans) => {
      const normalizedAns = ans
        .toLowerCase()
        .replace(/[\u30A1-\u30FA]/g, (match) =>
          String.fromCharCode(match.charCodeAt(0) - 0x60)
        )
        .replace(/\s+/g, "");

      const normalizedUserAnswer = userAnswerTrimmed
        .toLowerCase()
        .replace(/[\u30A1-\u30FA]/g, (match) =>
          String.fromCharCode(match.charCodeAt(0) - 0x60)
        )
        .replace(/\s+/g, "");

      // 正解の文字列が回答に含まれているかチェック
      return (
        normalizedUserAnswer.includes(normalizedAns) ||
        normalizedAns.includes(normalizedUserAnswer)
      );
    });

    // 回答履歴に追加（正解時のみ）
    if (isCorrect) {
      const newAnswer = {
        question: currentQuestion.question,
        userAnswer: userAnswerTrimmed,
        correctAnswer: correctAnswers[0],
        isCorrect: true,
      };
      setAnswers((prev) => [...prev, newAnswer]);

      // 正解したら時間経過を止める
      setTimerActive(false);
      // 正解時にスクロール
      setTimeout(scrollToBottom, 100); // 少し遅延させて実行
    }

    if (isCorrect) {
      sounds.correct();
      setFeedback({
        message: `正解！ 答え: ${correctAnswers[0]}`,
        type: "correct",
      });
      setIsAnswered(true); // 正解したらtrueに
    } else {
      sounds.incorrect();
      setFeedback({
        message: `不正解。もう一度挑戦してください。`,
        type: "incorrect",
      });
      // 不正解でもisAnsweredはfalseのまま（再挑戦できるように）
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-purple-800 to-blue-800 py-6 px-4 shadow-lg sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div
            className="text-2xl font-bold tracking-wider cursor-pointer"
            onClick={handleReturnToSelection}
          >
            RIDDLE MASTER
          </div>
          <nav className="md:flex space-x-8">
            {/* <a 
              href="#" 
              className="text-white hover:text-white/90 transition-colors relative after:content-[''] after:absolute after:w-0 after:h-0.5 after:bg-white after:bottom-[-5px] after:left-0 after:transition-all hover:after:w-full"
              onClick={(e) => {
                e.preventDefault();
                handleReturnToSelection();
              }}
            >
              ホーム
            </a> */}
          </nav>
        </div>
      </header>

      <main
        ref={mainContentRef}
        className="flex flex-grow container mx-auto px-4 py-8"
      >
        {/* 画面表示切り替え */}
        {screen === "home" && (
          <HomeScreen
            onStartQuiz={() => {
              sounds.phone();
              setScreen("quiz-list");
            }}
          />
        )}
        {screen === "quiz-list" && (
          <QuizListScreen
            quizData={quizData}
            loading={loading}
            completedStages={completedStages}
            handleStageSelect={handleStageSelect}
            stageNames={stageNames}
          />
        )}
        {screen === "game" && (
          <GameScreen
            currentStage={currentStage}
            currentQuestionIndex={currentQuestionIndex}
            questions={questions}
            elapsedTime={elapsedTime}
            formatTime={formatTime}
            handleHintToggle={handleHintToggle}
            currentQuestion={currentQuestion}
            isAnswered={isAnswered}
            feedback={feedback}
            handleNextQuestion={handleNextQuestion}
            handleAnswerSubmit={handleAnswerSubmit}
            userAnswer={userAnswer}
            setUserAnswer={setUserAnswer}
            stageNames={stageNames}
            setScreen={setScreen}
            sounds={{ success: sounds.success }}
            setEndTime={setEndTime}
            setTimerActive={setTimerActive}
            completedStages={completedStages}
            setCompletedStages={setCompletedStages}
            saveCompletedStages={saveCompletedStages}
          />
        )}
        {screen === "results" && (
          <ResultsScreen
            isAnswered={isAnswered}
            feedbackType={feedback.type}
            // width={width} // 削除
            // height={height} // 削除
            correctAnswersCount={correctAnswersCount}
            totalTime={totalTime}
            formatTime={formatTime}
            scorePercentage={scorePercentage}
            answers={answers}
            handleRetry={handleRetry}
            handleReturnToSelection={handleReturnToSelection}
          />
        )}
      </main>

      {/* 新しいヒントモーダル */}
      {showModal && (
        <HintModal
          hint={currentQuestion?.hint}
          onClose={() => setShowModal(false)} // モーダルを閉じる処理
        />
      )}

      {/* デコレーション */}
      <div className="fixed top-0 right-0 -z-10 w-[40%] h-screen bg-gradient-to-b from-purple-900/20 via-blue-900/20 to-transparent blur-3xl"></div>
      <div className="fixed bottom-0 left-0 -z-10 w-[40%] h-screen bg-gradient-to-t from-blue-900/20 via-indigo-900/20 to-transparent blur-3xl"></div>
    </div>
  );
}
