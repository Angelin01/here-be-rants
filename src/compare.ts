// Juxtapose 1.1.6 drops the images' alt text and leaves its slider without a name. It builds the slider only once its
// images load, so watch for that and fill both in. The labels live on our wrapper, juxtapose wipes its own element.

// Returns false if juxtapose hasn't built the slider yet
function labelSlider(wrapper: HTMLElement): boolean {
  const controller = wrapper.querySelector('.jx-controller');
  if (!controller) {
    return false;
  }

  const { beforeLabel, afterLabel } = wrapper.dataset;
  controller.setAttribute('aria-label', `Slider between ${beforeLabel} and ${afterLabel}`);
  wrapper.querySelector('.jx-left img')?.setAttribute('alt', beforeLabel ?? '');
  wrapper.querySelector('.jx-right img')?.setAttribute('alt', afterLabel ?? '');
  return true;
}

function main() {
  for (const wrapper of document.querySelectorAll<HTMLElement>('[data-compare]')) {
    if (labelSlider(wrapper)) {
      continue;
    }

    const observer = new MutationObserver(() => {
      if (labelSlider(wrapper)) {
        observer.disconnect();
      }
    });
    observer.observe(wrapper, { childList: true, subtree: true });
  }
}

main();
