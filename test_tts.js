const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--use-fake-ui-for-media-stream'] });
  const page = await browser.newPage();
  
  // Go to a blank page to test speech synthesis API
  await page.goto('about:blank');

  const result = await page.evaluate(() => {
    return new Promise((resolve) => {
      let log = [];
      const utterance = new SpeechSynthesisUtterance("Testing voice output");
      utterance.onstart = () => log.push("start");
      utterance.onend = () => {
        log.push("end");
        resolve(log);
      };
      utterance.onerror = (e) => {
        log.push("error: " + e.error);
        resolve(log);
      };
      
      // Wait for voices to load
      let voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.speak(utterance);
        };
      } else {
        window.speechSynthesis.speak(utterance);
      }
      
      // Safety timeout
      setTimeout(() => { resolve([...log, "timeout"]); }, 5000);
    });
  });

  console.log("TTS Test Result:", result);
  await browser.close();
})();
