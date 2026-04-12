import { useCallback, useEffect, useState } from 'react';
import type { ReplicantMap } from '../../nodecg/replicants';

export const useReplicant = <T extends keyof ReplicantMap>(
  name: T
): [ReplicantMap[T] | undefined, (newValue: ReplicantMap[T]) => void] => {
  const [rep] = useState(() => nodecg.Replicant(name));
  const [value, setValue] = useState<ReplicantMap[T] | undefined>(undefined);
  useEffect(() => {
    const handleChange = (newValue: ReplicantMap[T]) => setValue(newValue);
    rep.on('change', handleChange);
    return () => {
      rep.removeListener('change', handleChange);
    };
  }, [rep]);
  // eslint-disable-next-line react-hooks/immutability -- rep は NodeCG Replicant オブジェクトであり .value への代入が正規の更新 API
  return [value, useCallback((newValue) => (rep.value = newValue), [rep])];
};
