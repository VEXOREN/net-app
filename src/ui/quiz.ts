import { $, shuffle } from "../lib/dom";
import { gain, toast } from "../lib/progress";
import { QUESTIONS } from "../data/quiz";

const code = (s: string) => s.replace(/`([^`]+)`/g, "<code>$1</code>");

export function initQuiz() {
  let order: number[] = shuffle([...QUESTIONS.keys()]);
  let i = 0, score = 0, answered = 0;

  const progress = () => { $("#qzProg").textContent = `${i + 1}/${QUESTIONS.length} · wynik ${score}/${answered}`; };

  function show() {
    if (i >= order.length) {
      toast(`Runda: ${score}/${answered}`);
      order = shuffle([...QUESTIONS.keys()]); i = 0; score = 0; answered = 0;
    }
    const [q, opts, ans, ex] = QUESTIONS[order[i]];
    progress();
    $("#qzQ").innerHTML = code(q);
    $("#qzFb").className = "fb";
    const box = $("#qzOpts");
    box.innerHTML = "";
    let locked = false;
    opts.forEach((o, idx) => {
      const b = document.createElement("button");
      b.className = "qopt";
      b.innerHTML = code(o);
      b.addEventListener("click", () => {
        if (locked) return;
        locked = true; answered++;
        box.children[ans].classList.add("right");
        if (idx === ans) { score++; gain(3); } else b.classList.add("wrong");
        progress();
        const fb = $("#qzFb");
        fb.className = "fb show " + (idx === ans ? "ok" : "bad");
        fb.innerHTML = code(ex);
      });
      box.appendChild(b);
    });
  }

  $("#qzNext").addEventListener("click", () => { i++; show(); });
  show();
}
