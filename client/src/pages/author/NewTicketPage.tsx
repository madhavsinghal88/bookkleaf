import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { api, ApiError } from "../../api/client";
import type { Book, TicketDetail } from "../../api/types";

export function NewTicketPage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ items: Book[] }>("/books").then((r) => setBooks(r.items)).catch(() => setBooks([]));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      const ticket = await api.post<TicketDetail>("/tickets", {
        bookId: bookId || null,
        subject,
        description,
        // File upload is UI-only for this version: we record the file name.
        attachmentName: attachment?.name ?? null,
      });
      navigate(`/tickets/${ticket.id}`, { state: { justCreated: true } });
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setErrors(err.fieldErrors());
      else setFormError(err instanceof Error ? err.message : "Could not submit your query");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="narrow">
      <h1>Raise a support query</h1>
      <p className="muted">Tell us what's going on. Our team typically replies within one business day.</p>

      <form className="card form" onSubmit={onSubmit} noValidate>
        <label>
          Which book is this about?
          <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="">General / Account Level</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.status})
              </option>
            ))}
          </select>
        </label>

        <label>
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Royalty for last quarter not received"
            maxLength={150}
          />
          {errors.subject && <span className="field-error">{errors.subject}</span>}
        </label>

        <label>
          Describe the issue
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={7}
            maxLength={5000}
            placeholder="Include any dates, amounts, or platform names that will help us look into this quickly."
          />
          <span className="hint">{description.length}/5000</span>
          {errors.description && <span className="field-error">{errors.description}</span>}
        </label>

        <label>
          Attachment (optional)
          <input type="file" accept="image/*,.pdf" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} />
          <span className="hint">Screenshots or photos (e.g. of a print defect) help us resolve things faster.</span>
        </label>

        {formError && <div className="banner banner-error">{formError}</div>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit query"}
          </button>
        </div>
      </form>
    </div>
  );
}
