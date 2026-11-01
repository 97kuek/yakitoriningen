import { useEffect, useState } from 'react';

const units = ['B', 'KB', 'MB', 'GB', 'TB'];
function bytes(value: number) {
  const unit = Math.min(
    units.length - 1,
    Math.max(0, Math.floor(Math.log10(Math.max(1, value)) / 3)),
  );
  return `${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(value / 1000 ** unit)} ${units[unit]}`;
}

/** Browser-reported estimates for this origin, including assets and the local database. */
export function StorageStatus() {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  useEffect(() => {
    let active = true;
    void navigator.storage
      ?.estimate?.()
      .then((value) => {
        if (active) setEstimate(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  if (estimate?.usage === undefined || estimate.quota === undefined)
    return <p className="storage-capacity">容量の目安を取得できません。</p>;
  return (
    <dl className="storage-capacity" aria-label="保存容量の目安">
      <div>
        <dt>使用中</dt>
        <dd>{bytes(estimate.usage)}</dd>
      </div>
      <div>
        <dt>保存上限の目安</dt>
        <dd>{bytes(estimate.quota)}</dd>
      </div>
    </dl>
  );
}
