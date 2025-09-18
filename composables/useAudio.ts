import { useCallback, useRef, useState } from "react";

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
  unlockAudio: () => void;
  isAudioUnlocked: boolean;
}

export const useAudio = (defaultVolume: number = 1.0): AudioHook => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundsRef = useRef<SoundBuffers>({});
  const audioSourcesRef = useRef<AudioSources>({});
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  const loadAudio = useCallback(async (fileName: string): Promise<AudioBuffer> => {
    if (soundsRef.current[fileName]) {
      return soundsRef.current[fileName];
    }

    const response = await fetch(`/sounds/${fileName}.mp3`);
    const arrayBuffer = await response.arrayBuffer();

    if (!audioContextRef.current) {
      throw new Error('AudioContext not initialized');
    }

    const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
    soundsRef.current[fileName] = audioBuffer;
    return audioBuffer;
  }, []);

  // オーディオの再生
  const playAudio = useCallback(
    (fileName: string, volume = defaultVolume) => {
      if (!isAudioUnlocked || !audioContextRef.current) return;
      const audioBuffer = soundsRef.current[fileName];
      if (!audioBuffer) return;

      try {
        const audioSource = audioContextRef.current.createBufferSource();
        audioSource.buffer = audioBuffer;

        if (volume) {
          const gainNode = audioContextRef.current.createGain();
          gainNode.gain.value = volume;
          gainNode.connect(audioContextRef.current.destination);
          audioSource.connect(gainNode);
        } else {
          audioSource.connect(audioContextRef.current.destination);
        }

        // 再生中のソースを保存
        audioSourcesRef.current[fileName] = audioSource;
        audioSource.start();

        // 再生終了時にソースをクリア
        audioSource.onended = () => {
          audioSourcesRef.current[fileName] = null;
        };
      } catch (error) {
        console.error('Error playing audio:', error);
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current
            .resume()
            .then(() => {
              console.log('AudioContext resumed successfully.');
            })
            .catch((resumeError) => {
              console.error('Failed to resume AudioContext:', resumeError);
            });
        }
      }
    },
    [isAudioUnlocked, defaultVolume]
  );

  // オーディオの停止
  const stopAudio = useCallback((fileName: string) => {
    const audioSource = audioSourcesRef.current[fileName];
    if (audioSource) {
      try {
        audioSource.stop();
        audioSourcesRef.current[fileName] = null; // 停止後、参照をクリア
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    }
  }, []);

  // AudioContextの初期化とアンロック
  const unlockAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioContextRef.current = new AudioContext();
      } else {
        console.error('Web Audio API is not supported in this browser.');
        return;
      }
    }

    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current
          .resume()
          .then(() => {
            console.log('AudioContext resumed!');
            setIsAudioUnlocked(true);
          })
          .catch((e) => console.error('Error resuming AudioContext:', e));
      } else if (audioContextRef.current.state === 'running') {
        console.log('AudioContext already running.');
        setIsAudioUnlocked(true);
      }
    }
  }, []);

  return { loadAudio, playAudio, stopAudio, unlockAudio, isAudioUnlocked };
}
