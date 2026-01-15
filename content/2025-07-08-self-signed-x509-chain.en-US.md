---
title: Self-signed X.509 certificate chains w/ ECC
tags: 开发
---

Recently I need to generate a few X.509 certificates for connection authentication in QUIC. A custom root trust anchors is used to sign certificates for each nodes, and these certificates will be presented as client and server certificates during QUIC handshake.

Ideally, we want a short certificate, so ECDSA p256 is chosen as the signature algorithm. Additionally, modern TLS implementations use the `serverAltName` extension (SAN) for host verification instead of common names (see [[rfc6125]](https://www.rfc-editor.org/info/rfc6125)), so we have to place our node identifiers there. Fortunately we can use non-existent but valid domain names in SAN.

The following commands are tested with OpenSSL 3.4.1.

```bash
# Generate trust anchor's key
openssl ecparam -out ca.key.pem -name prime256v1 -genkey
# Generate trust anchor's certificate, valid for 10yr.
# No SAN is needed here.
openssl req -new -key ca.key.pem -x509 -nodes -days 3650 \
  -out ca.pem -subj "/CN=ca"

# Generate node's key
openssl ecparam -out node.key.pem -name prime256v1 -genkey
# Generate node's certificate signing request (CSR)
openssl req -sha256 -new -nodes -key node.key.pem \
  -out node.csr -subj "/CN=node" \
  -addext "subjectAltName=DNS:node.foo.bar"

# Sign a certificate, valid for 1yr.
# Note that we need to tell OpenSSL to copy extensions from
#   CSR into the resulting cert
openssl x509 -req -days 365 -in node.csr -out node.pem \
  -CA ./ca.pem -CAkey ./ca.key.pem \
  -CAcreateserial -copy_extensions copy
# Outputs:
# > Certificate request self-signature ok
# > subject=CN=node
```

You can use `openssl x509 -noout -text -in node.pem` to check the resulting certificate.
