// A small tag shown only while generated demo orders are included in the numbers
export default function DemoTag({ show }) {
  if (!show) return null;
  return (
    <span className="demo-tag" title="These numbers include generated demo orders">
      Demo data
    </span>
  );
}
