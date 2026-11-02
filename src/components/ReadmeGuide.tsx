import readme from '../../README.md?raw';
import accounting from '../../docs/images/accounting.png';
import history from '../../docs/images/history.png';
import settings from '../../docs/images/settings.png';
import summary from '../../docs/images/summary.png';
import './ReadmeGuide.css';

const screenshots: Record<string, string> = {
  accounting,
  history,
  settings,
  summary,
};
// The README is the source of the operator guide; developer sections stay outside the app.
const usage =
  readme.split('\n## 使い方\n')[1]?.split('\n## 開発・起動\n')[0].trim() ?? '';

export function ReadmeGuide() {
  return (
    <section className="readme-guide" aria-label="使い方">
      {usage.split(/\n\s*\n/).map((block, index) => {
        const image = /^!\[([^\]]*)\]\(\.\/docs\/images\/(\w+)\.png\)$/.exec(
          block,
        );
        if (image)
          return <img key={index} src={screenshots[image[2]]} alt={image[1]} />;
        if (block.startsWith('#### '))
          return <h4 key={index}>{block.slice(5)}</h4>;
        if (block.startsWith('### '))
          return <h3 key={index}>{block.slice(4)}</h3>;
        return <p key={index}>{block}</p>;
      })}
    </section>
  );
}
