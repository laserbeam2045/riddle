import { useCallback, useState } from "react";

type SoundBuffers = {
  [key: string]: AudioBuffer;
};

type AudioSources = {
  [key: string]: AudioBufferSourceNode | null;
};

interface AudioHook {
  loadAudio: (fileName: string) => Promise<AudioBuffer>;
  playAudio: (fileName: string, volume?: number) => void;
  stopAudio: (fileName: string) => void;
  playAudioSafe: (fileName: string, volume?: number) => void;
  unlockAudio: () => void;
  isAudioUnlocked: boolean;
}

// シングルトン用の外部変数
let globalAudioContext: AudioContext | null = null;
const globalSounds: SoundBuffers = {};
const globalAudioSources: AudioSources = {};
let globalIsAudioUnlocked = false;

export const useAudio = (defaultVolume: number = 1.0): AudioHook => {
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(globalIsAudioUnlocked);

  const loadAudio = useCallback(async (fileName: string): Promise<AudioBuffer> => {
    if (globalSounds[fileName]) {
      return globalSounds[fileName];
    }

    const response = await fetch(`/sounds/${fileName}.mp3`);
    const arrayBuffer = await response.arrayBuffer();

    if (!globalAudioContext) {
      throw new Error('AudioContext not initialized');
    }

    const audioBuffer = await globalAudioContext.decodeAudioData(arrayBuffer);
    globalSounds[fileName] = audioBuffer;
    return audioBuffer;
  }, []);

  // オーディオの再生
  const playAudio = useCallback(
    (fileName: string, volume = defaultVolume) => {
      if (!globalIsAudioUnlocked || !globalAudioContext) return;
      const audioBuffer = globalSounds[fileName];
      if (!audioBuffer) return;

      try {
        const audioSource = globalAudioContext.createBufferSource();
        audioSource.buffer = audioBuffer;

        if (volume !== undefined) {
          const gainNode = globalAudioContext.createGain();
          gainNode.gain.value = volume;
          gainNode.connect(globalAudioContext.destination);
          audioSource.connect(gainNode);
        } else {
          audioSource.connect(globalAudioContext.destination);
        }

        // 再生中のソースを保存
        globalAudioSources[fileName] = audioSource;
        audioSource.start();

        // 再生終了時にソースをクリア
        audioSource.onended = () => {
          globalAudioSources[fileName] = null;
        };
      } catch (error) {
        console.error('Error playing audio:', error);
        if (globalAudioContext.state === 'suspended') {
          globalAudioContext
            .resume()
            .then(() => {
              // console.log('AudioContext resumed successfully.');
            })
            .catch((resumeError) => {
              console.error('Failed to resume AudioContext:', resumeError);
            });
        }
      }
    },
    [defaultVolume]
  );

  // オーディオの停止
  const stopAudio = useCallback((fileName: string) => {
    const audioSource = globalAudioSources[fileName];
    if (audioSource) {
      try {
        audioSource.stop();
        globalAudioSources[fileName] = null; // 停止後、参照をクリア
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    }
  }, []);

  // AudioContextの初期化とアンロック
  const unlockAudio = useCallback(() => {
    if (!globalAudioContext) {
      const AudioContext = window.AudioContext; //  || window.webkitAudioContext;
      if (AudioContext) {
        globalAudioContext = new AudioContext();
      } else {
        console.error('Web Audio API is not supported in this browser.');
        return;
      }
    }

    if (globalAudioContext) {
      if (globalAudioContext.state === 'suspended') {
        globalAudioContext
          .resume()
          .then(() => {
            // console.log('AudioContext resumed!');
            globalIsAudioUnlocked = true;
            setIsAudioUnlocked(true);
          })
          .catch((e) => console.error('Error resuming AudioContext:', e));
      } else if (globalAudioContext.state === 'running') {
        // console.log('AudioContext already running.');
        globalIsAudioUnlocked = true;
        setIsAudioUnlocked(true);
      }
    }
  }, []);

  // 安全な再生関数（重複防止・汎用版）
  const playAudioSafe = useCallback((fileName: string, volume = defaultVolume) => {
    if (!globalIsAudioUnlocked || !globalAudioContext) return;

    // 現在再生中の同じファイルを停止
    const currentAudio = globalAudioSources[fileName];
    if (currentAudio) {
      try {
        currentAudio.stop();
        globalAudioSources[fileName] = null;
      } catch (error) {
        console.error(error)
      }
    }

    const audioBuffer = globalSounds[fileName];
    if (!audioBuffer) return;

    try {
      const audioSource = globalAudioContext.createBufferSource();
      audioSource.buffer = audioBuffer;

      if (volume !== undefined) {
        const gainNode = globalAudioContext.createGain();
        gainNode.gain.value = volume;
        gainNode.connect(globalAudioContext.destination);
        audioSource.connect(gainNode);
      } else {
        audioSource.connect(globalAudioContext.destination);
      }
      globalAudioSources[fileName] = audioSource;
      audioSource.start();

      audioSource.onended = () => {
        // globalAudioSources[fileName] = null;
      };
    } catch (error) {
      console.error(`Error playing ${fileName}:`, error);
    }
  }, [defaultVolume]);

  return { loadAudio, playAudio, stopAudio, playAudioSafe, unlockAudio, isAudioUnlocked };
}
