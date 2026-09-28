import {getFamilies, getCategories} from '../lib/catalog.js';
import HelpButton from './HelpButton.jsx';

export default function Welcome({onStart}){
  const families = getFamilies();

  return(
    <section id="welcome">
      <HelpButton className="icon-btn help-btn help-btn-floating" />

      <div className="welcome-inner">
        <h1>AutoCoinScan</h1>
        <p className="sub">
          Detect, Classify and Valuate Coins with Low Latency.
        </p>

        <div className="welcome-card">
          <div className="welcome-section">
            <div className="section-label">Summary</div>
            <p>
              AutoCoinScan turns a single photo into a full read out of every
              coin in the frame, predicting what it is, its estimated grade,
              and what it's worth. Point your camera at your coins or upload an
              image, and let the model do the rest.
              <br /><br />
              Under the hood, a YOLO object detector localises each coin in the
              image and corrects for camera angle distortion, then a
              ConvNeXt-based classifier &amp; DINO-based grading model identifies
              the coin type, estimates its Sheldon 70-point scale grade, and
              cross-references recent sale data and NGC reference price.
            </p>
          </div>

          <div className="welcome-section">
            <div className="section-label">How it works</div>

            <ol className="welcome-steps">
              <li>
                Take a photo (or upload one) with one or more coins clearly in
                frame.
              </li>
              <li>
                AutoCoinScan detects and isolates every coin above the
                confidence cutoff.
              </li>
              <li>
                Each coin is classified &amp; graded, then priced against
                recent sales.
              </li>
              <li>
                Click any coin in the photo or the sidebar to see its full
                breakdown, or use the expand button in the sidebar to review
                every detected coin at once.
              </li>
            </ol>
          </div>

          <div className="welcome-section">
            <div className="section-label">Coin Classification</div>

            <p>
              AutoCoinScan classifies coins based on their family, category,
              variety, face value, and year.
              <br /><br />
              You may edit the coin's identity in the sidebar to correct any
              misclassifications, and the model will update its predictions
              accordingly. You may also compare your coin with the model's best
              guess and reference images from NGC to verify its identity.
              <br /><br />
              Please refer to the supported coins section below for a list of
              families and categories that the system currently supports.
            </p>
          </div>

          <div className="welcome-section">
            <div className="section-label">Sheldon 70-point scale</div>

            <p>
              Sheldon 70-point scale is a widely used grading system for coins,
              ranging from 1 (Poor) to 70 (Perfect Mint State). AutoCoinScan
              predicts the grade of each coin based on its condition, wear, and
              other factors, providing an estimated grade that can help
              collectors and enthusiasts assess the value of their coins.
              <br /><br />
              Do note that it is extremely difficult to accurately grade coins
              from a single image, and the model's predictions may not always
              align with professional grading services. You should use the
              distribution of predicted grades as a rough guide, and consult
              with a professional numismatist for authoritative assessments.
            </p>
          </div>

          <div className="welcome-section">
            <div className="section-label">Tips for best results</div>

            <p>
              Even lighting, a plain background, a high-resolution camera, and a
              straight-down angle give the best results.
            </p>
          </div>

          <div className="welcome-section">
            <div className="section-label">Supported Coins</div>

            <div className="supported-list">
              {families.map((family) => (
                <div className="supported-family" key={family}>
                  <span className="supported-family-name">
                    {family}
                  </span>
                  <span className="supported-family-cats">
                    {getCategories(family).join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="welcome-section">
            <div className="section-label">Disclaimer</div>

            <p>
              This project aims to demonstrate the capabilities of modern
              computer vision techniques for coin classification and valuation,
              as well as to provide numismatics beginners with a tool for
              learning and exploration.
              <br /><br />
              Users should not rely solely on the results provided by
              AutoCoinScan for any financial or investment decisions. All resources 
              used in this project are sourced from publicly available
              data from NGC UK and PCGS, and the project is not affiliated with
              or endorsed by any numismatic organization. Users are encouraged
              to consult with professional numismatists for authoritative
              assessments.
            </p>
          </div>
        </div>

        <button
          className="btn-primary btn-get-started"
          onClick={onStart}
        >
          Get started --{'>'}
        </button>
      </div>
    </section>
  );
}