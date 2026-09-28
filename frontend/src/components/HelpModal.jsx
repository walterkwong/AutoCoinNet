export default function HelpModal({onClose}){
  return(
    <div
      className="modal"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-card help-modal-card">
        <h2>About AutoCoinScan</h2>

        <p className="help-intro">
          AutoCoinScan detects, identifies, and grades coins from a photo. It
          first localises each coin using YOLO, corrects for camera-angle
          distortion, and runs it through a ConvNeXt-based classifier and
          DINO-based grading model to estimate its type, Sheldon-scale grade,
          and market value.
        </p>

        <div className="help-section">
          <div className="section-label">Scanning</div>
          <p>
            Take a photo (or upload one) with one or more coins clearly in
            frame. AutoCoinScan detects and isolates every coin of sufficient
            resolution, then classifies and grades them all at once. Click
            any coin in the photo or the sidebar to see its details, or use the
            expand button in the sidebar to review every detected coin at once.
          </p>
        </div>

        <div className="help-section">
          <div className="section-label">Tips</div>
          <p>
            Even lighting, a plain background, a high-resolution camera, and a
            straight-down angle give the best results.
          </p>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}