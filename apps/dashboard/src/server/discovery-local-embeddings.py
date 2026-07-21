"""Batch local embeddings for Discovery only. JSON input/output keeps Node runtime dependency-free."""
import json
import os
import sys


def main():
    payload = json.load(sys.stdin)
    texts = [text if isinstance(text, str) else str(text) for text in payload.get("texts", [])]
    if not texts:
        print(json.dumps({"embeddings": [], "model": "BAAI/bge-m3", "device": "cpu"}))
        return

    from sentence_transformers import SentenceTransformer
    import torch

    model_name = os.getenv("DISCOVERY_LOCAL_EMBEDDING_MODEL", "BAAI/bge-m3")
    capability = ""
    if torch.cuda.is_available():
        major, minor = torch.cuda.get_device_capability()
        capability = f"sm_{major}{minor}"
    # A visible GPU is not enough: CPU fallback avoids unsupported-architecture failures.
    device = "cuda" if capability and capability in torch.cuda.get_arch_list() else "cpu"
    model = SentenceTransformer(model_name, device=device, trust_remote_code=False)
    batch_size = int(os.getenv("DISCOVERY_LOCAL_EMBEDDING_BATCH_SIZE", "4"))
    # Keep outer batches small: title metadata can contain malformed/very long text
    # and this isolates it from the full discovery run.
    output = []
    for offset in range(0, len(texts), batch_size):
        batch = [text.replace("\x00", " ").encode("utf-8", "replace").decode("utf-8")[:4096] for text in texts[offset:offset + batch_size]]
        try:
            vectors = model.encode(
                batch,
                batch_size=batch_size,
                normalize_embeddings=True,
                show_progress_bar=False,
                convert_to_numpy=True,
            )
        except Exception as error:
            raise RuntimeError(f"Embedding batch {offset}:{offset + len(batch)} failed: {batch!r}") from error
        output.extend(vectors.tolist())
    print(json.dumps({"embeddings": output, "model": model_name, "device": device}))


if __name__ == "__main__":
    main()
