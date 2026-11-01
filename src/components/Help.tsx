import { Dialog } from './controls';

const CONTACT_EMAIL = 'ueki.keitaro@gmail.com';
const REPOSITORY_URL = 'https://github.com/97kuek/yakitoriningen';
export function Help({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="このアプリについて"
      className="help-dialog"
    >
      <p>
        WASAの早稲田祭出店「焼き鳥人間」で、会計から商品の受け渡しまでを記録するアプリです。
      </p>
      <p>
        記録はこのPCのブラウザに保存します。他の端末との自動同期はありません。
      </p>
      <dl className="about-details">
        <dt>お問い合わせ</dt>
        <dd>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </dd>
        <dt>ソースコード</dt>
        <dd>
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </dd>
        <dt>ライセンス</dt>
        <dd>
          <a
            href={`${REPOSITORY_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noreferrer"
          >
            MIT License
          </a>
        </dd>
      </dl>
    </Dialog>
  );
}
