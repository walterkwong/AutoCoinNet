import {useState} from 'react';
import HelpModal from './HelpModal.jsx';

export default function HelpButton({className = 'icon-btn help-btn'}){
  const [open, setOpen] = useState(false);

  return(
    <>
      <button
        className={className}
        title="About & how to use"
        aria-label="Help"
        onClick={() => setOpen(true)}
      >
        ?
      </button>

      {open && <HelpModal onClose={() => setOpen(false)} />}
    </>
  );
}