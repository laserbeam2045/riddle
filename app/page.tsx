/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

import { useState, useEffect } from "react";
import useSound from "use-sound";

// 謎解きのデータ型定義
interface Question {
  question: string;
  imageUrl?: string;
  answers: string[];
  hint?: string;
  explanation?: string;
}

interface QuizData {
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

const stageNames = ["なぞなぞ", "なぞなぞ２", "なぞなぞ３", "文学", "地理", "音楽"];

export default function Home() {
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
  const [answers, setAnswers] = useState<{question: string; isCorrect: boolean; userAnswer: string; correctAnswer: string}[]>([]);
  const [attemptCount, setAttemptCount] = useState(0); // 回答試行回数
  
  // 画面表示状態
  const [screen, setScreen] = useState<'home' | 'quiz-list' | 'game' | 'results'>('home');

  const { quizData, loading, error } = useQuizData();
  const questions = currentStage ? quizData[currentStage] || [] : [];
  const currentQuestion = questions[currentQuestionIndex];

  const sounds = {
    correct: useSound("/sounds/correct.mp3", { volume: 0.5 })[0],
    incorrect: useSound("/sounds/incorrect.mp3", { volume: 0.5 })[0],
    cursor: useSound("/sounds/sound01.mp3", { volume: 0.5 })[0],
  };

  // 経過時間計測用のタイマー
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timerActive) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [timerActive]);

  const handleStageSelect = (stage: number) => {
    setCurrentStage(stage);
    setCurrentQuestionIndex(0);
    setUserAnswer("");
    setFeedback({ message: "", type: "" });
    setIsAnswered(false);
    setShowHint(false);
    setAnswers([]);
    setScreen('game');
    setShowResults(false);
    setStartTime(Date.now());
    setElapsedTime(0);
    setAttemptCount(0);
    
    // タイマー開始
    setTimerActive(true);
  };

  const handleAnswerSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentQuestion) return;
    
    // 回答試行回数を増やす
    setAttemptCount(prev => prev + 1);

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
      return normalizedUserAnswer.includes(normalizedAns) || normalizedAns.includes(normalizedUserAnswer);
    });

    // 回答履歴に追加（正解時のみ）
    if (isCorrect) {
      const newAnswer = {
        question: currentQuestion.question,
        userAnswer: userAnswerTrimmed,
        correctAnswer: correctAnswers[0],
        isCorrect: true
      };
      setAnswers(prev => [...prev, newAnswer]);
      
      // 正解したら時間経過を止める
      setTimerActive(false);
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

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
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
      setEndTime(Date.now());
      setShowResults(true);
      setScreen('results');
      setTimerActive(false);
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
    setCurrentStage(null);
    setCurrentQuestionIndex(0);
    setUserAnswer("");
    setFeedback({ message: "", type: "" });
    setIsAnswered(false);
    setShowHint(false);
    setShowResults(false);
    setAnswers([]);
    setScreen('home');
    setTimerActive(false);
  };

  const handleHintToggle = () => {
    setShowModal(!showModal);
    setShowHint(!showHint);
  };

  const handleRetry = () => {
    // 現在のステージを再度プレイ
    setCurrentQuestionIndex(0);
    setUserAnswer("");
    setFeedback({ message: "", type: "" });
    setIsAnswered(false);
    setShowHint(false);
    setShowResults(false);
    setAnswers([]);
    setStartTime(Date.now());
    setEndTime(null);
    setScreen('game');
    setElapsedTime(0);
    setAttemptCount(0);
    
    // タイマー開始
    setTimerActive(true);
  };

  // 正解数の計算
  const correctAnswersCount = answers.filter(answer => answer.isCorrect).length;
  
  // 経過時間の計算（秒）
  const totalTime = startTime && endTime ? Math.floor((endTime - startTime) / 1000) : elapsedTime;
  
  // スコアのパーセンテージ計算
  const scorePercentage = questions.length > 0 ? Math.round((correctAnswersCount / questions.length) * 100) : 0;

  // 分と秒に整形する関数
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' + secs : secs}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-purple-800 to-blue-800 py-6 px-4 shadow-lg">
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

      <main className="flex flex-grow container mx-auto px-4 pt-8">
        {/* ホーム画面 */}
        {screen === 'home' && (
          <div className="hero text-center py-12">
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-purple-600 inline-block text-transparent bg-clip-text">
              頭脳の限界を超えろ！
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              様々なカテゴリーの問題に挑戦して、知識を広げ、ランキングでトップを目指そう。友達と競い合って、謎解き王の称号を手に入れよう！
            </p>
            <button 
              className="bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 px-8 rounded-full font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              onClick={() => setScreen('quiz-list')}
            >
              いますぐプレイ
            </button>
          </div>
        )}

        {/* 謎解きリスト画面 */}
        {screen === 'quiz-list' && (
          <div className="quiz-container">
            {/* <div className="quiz-header flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 inline-block text-transparent bg-clip-text">
                トレンドの謎解き
              </h2>
              <div className="categories flex space-x-4">
                <div className="category px-4 py-2 bg-white/10 rounded-full cursor-pointer transition-all hover:bg-white/20 hover:-translate-y-0.5 active">
                  すべて
                </div>
                {stageNames.slice(0, 3).map((name, index) => (
                  <div key={index} className="category px-4 py-2 bg-white/10 rounded-full cursor-pointer transition-all hover:bg-white/20 hover:-translate-y-0.5">
                    {name}
                  </div>
                ))}
              </div>
            </div> */}

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : (
              <div className="quiz-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.keys(quizData).map((stageKey) => {
                  const stageNumber = parseInt(stageKey);
                  const stageName = stageNames[stageNumber - 1];
                  
                  return (
                    <div 
                      key={stageKey} 
                      className="quiz-card bg-gray-800/50 rounded-xl overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 duration-300"
                    >
                      <div className="h-40 bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                        <div className="text-3xl font-bold">{stageName}</div>
                      </div>
                      <div className="quiz-content p-6">
                        {/* <h3 className="text-xl font-bold mb-2">{stageName}</h3> */}
                        <div className="quiz-meta flex justify-between text-gray-400 text-sm mb-3">
                          <div>{quizData[stageNumber].length} 問</div>
                          <div>難易度: 普通</div>
                        </div>
                        <p className="quiz-description text-gray-300 mb-4">
                          {stageName}に関する様々な問題に挑戦しよう。あなたの知恵をテストします！
                        </p>
                        <div className="quiz-footer flex justify-between items-center">
                          <div className="difficulty-meter flex items-center">
                            <span className="bg-green-500 inline-block w-2 h-2 rounded-full mr-1"></span>
                            <span className="bg-green-500 inline-block w-2 h-2 rounded-full mr-1"></span>
                            <span className="bg-green-500 inline-block w-2 h-2 rounded-full mr-1"></span>
                            <span className="bg-gray-500 inline-block w-2 h-2 rounded-full mr-1"></span>
                            <span className="bg-gray-500 inline-block w-2 h-2 rounded-full"></span>
                          </div>
                          <button 
                            className="bg-gradient-to-r from-pink-500 to-purple-600 text-white py-2 px-5 rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                            onClick={() => handleStageSelect(stageNumber)}
                          >
                            プレイする
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ゲーム画面 */}
        {screen === 'game' && currentStage && currentQuestion && (
          <div className="flex-grow-3 flex justify-between flex-col game-screen bg-gray-800/70 rounded-2xl p-4 max-w-4xl mx-auto shadow-2xl">
            <div className="game-header flex flex-wrap justify-between items-center mb-4 pb-4 border-b border-gray-700">
              <h2 className="game-title text-2xl font-bold grow-10">{stageNames[currentStage - 1]}</h2>
              <div className="game-info flex items-center justify-between grow-1 space-x-4">
                <div className="timer flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="time-left text-sm">{formatTime(elapsedTime)}</span>
                </div>
                <div className="question-progress text-sm text-gray-400">
                  {currentQuestionIndex + 1}/{questions.length}
                </div>
                {currentQuestion.hint && (
                  <button
                    type="button"
                    onClick={handleHintToggle}
                    className="bg-amber-600/80 text-white py-1 px-3 rounded-lg text-sm transition hover:bg-amber-700 active:scale-95 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ヒント
                  </button>
                )}
              </div>
            </div>
            
            <div className="question-container grow-3 flex flex-col justify-between">
              <div className="question-number text-gray-400 mb-2">質問 {currentQuestionIndex + 1}</div>
              <div className="question-text text-xl whitespace-pre-line">{currentQuestion.question}</div>
              
              {currentQuestion.imageUrl && (
                <div className="image-container flex justify-center">
                  <img
                    src={currentQuestion.imageUrl}
                    alt="問題の画像"
                    className="max-h-64 rounded-lg"
                  />
                </div>
              )}
              
              <div className="feedback text-center h-8 font-bold grow-4 flex items-center justify-center">
                {feedback.message && (
                  <div className={`text-lg font-semibold ${feedback.type === "correct" ? "text-green-500" : "text-red-500"}`}>
                    {feedback.message}
                  </div>
                )}
              </div>
            </div>

            <div className="answer-container">
              {!isAnswered ? (
                <form onSubmit={handleAnswerSubmit} className="mt-4">
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full px-5 py-4 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                      placeholder="答えを入力してください"
                      autoComplete="off"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-2.5 rounded-lg transition-all duration-300 hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                      disabled={userAnswer.trim() === ""}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 5l7 7-7 7M5 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="">
                  {currentQuestion.explanation && (
                    <div className="explanation bg-indigo-900/30 border-l-4 border-indigo-500 pl-4 pr-2 py-4 rounded-lg">
                      <h4 className="font-bold text-indigo-300 text-xl mb-2">解説:</h4>
                      <pre className="text-gray-300 whitespace-pre-line text-xs">{currentQuestion.explanation}</pre>
                    </div>
                  )}
                </div>
              )}
              
              <div className="action-buttons flex justify-end mt-4">
                {isAnswered && (
                  <button
                    onClick={handleNextQuestion}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-6 rounded-lg transition-all duration-200 hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 active:scale-95"
                  >
                    {currentQuestionIndex < questions.length - 1 ? "次の問題" : "結果を見る"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 結果画面 */}
        {screen === 'results' && (
          <div className="results-screen bg-gray-800/70 rounded-2xl p-8 max-w-4xl mx-auto shadow-2xl">
            <h2 className="results-title text-3xl font-bold text-center mb-8">謎解き結果</h2>
            
            <div className="score-circle w-48 h-48 rounded-full border-8 border-indigo-600 mx-auto mb-8 flex items-center justify-center">
              <div className="score-inner text-center">
                <div className="score-value text-5xl font-bold text-indigo-400 mb-2">{scorePercentage}%</div>
                <div className="score-label text-sm text-gray-400">スコア</div>
              </div>
            </div>
            
            <div className="score-details flex justify-around mb-10 text-center">
              <div className="detail-item">
                <div className="detail-value text-2xl font-bold text-green-500 mb-1">{correctAnswersCount}</div>
                <div className="detail-label text-sm text-gray-400">正解</div>
              </div>
              <div className="detail-item">
                <div className="detail-value text-2xl font-bold text-red-500 mb-1">{questions.length - correctAnswersCount}</div>
                <div className="detail-label text-sm text-gray-400">不正解</div>
              </div>
              <div className="detail-item">
                <div className="detail-value text-2xl font-bold text-yellow-500 mb-1">{formatTime(totalTime)}</div>
                <div className="detail-label text-sm text-gray-400">所要時間</div>
              </div>
            </div>
            
            <div className="result-message text-center text-xl mb-10 text-gray-200">
              {scorePercentage >= 80 ? (
                "すばらしい！あなたは本当のリドルマスターです！"
              ) : scorePercentage >= 60 ? (
                "よくできました！もう少しで完璧です！"
              ) : scorePercentage >= 40 ? (
                "悪くない結果です。もっと頑張りましょう！"
              ) : (
                "まだまだ勉強が必要ですね。もう一度挑戦しましょう！"
              )}
            </div>
            
            <div className="action-buttons flex justify-center space-x-4">
              <button
                onClick={handleRetry}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-8 rounded-lg transition-all duration-200 hover:shadow-lg hover:from-purple-700 hover:to-indigo-700 active:scale-95"
              >
                もう一度挑戦
              </button>
              <button
                onClick={handleReturnToSelection}
                className="bg-gradient-to-r from-gray-700 to-gray-600 text-white py-3 px-8 rounded-lg transition-all duration-200 hover:shadow-lg hover:from-gray-800 hover:to-gray-700 active:scale-95"
              >
                ホームに戻る
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-gray-800 py-8 mt-8 text-center">
        {/* <div className="footer-links flex justify-center space-x-8 mb-6">
          <a href="#" className="text-gray-400 hover:text-white transition-colors">会社情報</a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors">利用規約</a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors">プライバシーポリシー</a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors">お問い合わせ</a>
        </div> */}
        <p className="text-gray-500 text-sm"> 2025 RIDDLE MASTER All Rights Reserved.</p>
      </footer>

      {/* ヒントモーダル */}
      {showModal && currentQuestion && currentQuestion.hint && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 overscroll-none overflow-hidden"
          onClick={handleHintToggle}
        >
          <div 
            className="bg-white/80 backdrop-blur-md rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl border border-white/50 transform transition-all duration-300 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">ヒント</h3>
              <button
                onClick={handleHintToggle}
                className="text-gray-500 hover:text-gray-800 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <pre className="hint-content bg-amber-50/90 backdrop-blur-sm border-l-4 border-amber-400 text-amber-800 p-4 rounded-lg text-base">
              {currentQuestion.hint}
            </pre>
            <div className="mt-6 text-center">
              <button
                onClick={handleHintToggle}
                className="bg-indigo-600/90 backdrop-blur-sm text-white py-2 px-6 rounded-lg transition-all duration-200 hover:bg-indigo-700 active:scale-95"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 装飾用の光の効果 */}
      <div className="fixed top-0 left-0 w-96 h-96 rounded-full bg-purple-800/20 blur-3xl -z-10 animate-blob"></div>
      <div className="fixed bottom-0 right-0 w-96 h-96 rounded-full bg-blue-800/20 blur-3xl -z-10 animate-blob animation-delay-2000"></div>
    </div>
  );
}
