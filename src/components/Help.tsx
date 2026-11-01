import { Dialog } from './controls';
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
      <p>焼き鳥人間の会計・注文管理アプリです。</p>
      <dl className="about-details">
        <dt>お問い合わせ</dt>
        <dd>
          <a href="mailto:ueki.keitaro@gmail.com">ueki.keitaro@gmail.com</a>
        </dd>
        <dt>ライセンス</dt>
        <dd>
          <a
            href="https://github.com/97kuek/yakitoriningen/blob/main/LICENSE"
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
