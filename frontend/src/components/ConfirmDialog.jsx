import Modal from './Modal.jsx'

export default function ConfirmDialog({ open, title, message, onCancel, onConfirm, confirmLabel = 'Delete' }) {
  return (
    <Modal
      open={open}
      title={title || 'Please confirm'}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Modal>
  )
}
