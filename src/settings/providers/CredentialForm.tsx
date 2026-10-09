import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Environment } from "../../auth/environment";
import { TextField } from "../../customer/TextField";
import { Button } from "../../support/ui/Button";
import {
  credentialErrors,
  credentialPayload,
  initialValues,
  type FormErrors,
} from "./credentialPayload";
import { PemField } from "./PemField";
import { fieldsFor, isSecret } from "./providerFields";
import { putCredentials } from "./providersApi";
import type { StoredSecret } from "./storedSecret";
import { SecretField } from "./SecretField";
import type { FieldKind, ProviderId } from "./types";

type Props = {
  provider: ProviderId;
  environment: Environment;
  storedFields: Record<string, string>;
  secretsSet: Record<string, boolean>;
  onSaved: () => void;
};

type InputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  secret?: StoredSecret;
};

const INPUTS: Record<FieldKind, (props: InputProps) => ReactNode> = {
  text: ({ onChange, ...input }) => (
    <TextField {...input} onChange={(event) => onChange(event.target.value)} />
  ),
  secret: ({ secret, ...input }) => <SecretField {...input} secret={secret ?? { isSet: false }} />,
  pem: (input) => <PemField {...input} />,
};

export function CredentialForm({
  provider,
  environment,
  storedFields,
  secretsSet,
  onSaved,
}: Props) {
  const specs = fieldsFor(provider, environment);
  const [values, setValues] = useState(() => initialValues(specs, storedFields));
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<FormErrors>({});

  const save = useMutation({
    mutationFn: () => putCredentials(provider, credentialPayload(specs, values, removed)),
    onSuccess: () => {
      // No secret outlives the save: the inputs go blank and the placeholder says it is stored.
      setValues((current) => ({ ...current, ...initialValues(specs.filter(isSecret), {}) }));
      setRemoved({});
      onSaved();
    },
    onError: (error) => setErrors(credentialErrors(error, specs)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    save.mutate();
  }

  function setRemoval(name: string, isRemoved: boolean) {
    setRemoved((current) => ({ ...current, [name]: isRemoved }));
    setValues((current) => ({ ...current, [name]: "" }));
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-3">
      {specs.map((spec) => (
        <div key={spec.name}>
          {INPUTS[spec.kind]({
            id: `${provider}-${spec.name}`,
            label: spec.label,
            value: values[spec.name] ?? "",
            onChange: (value) => setValues((current) => ({ ...current, [spec.name]: value })),
            error: errors[spec.name],
            secret: isSecret(spec)
              ? {
                  isSet: secretsSet[spec.name] === true,
                  removed: removed[spec.name] === true,
                  onRemove: () => setRemoval(spec.name, true),
                  onKeep: () => setRemoval(spec.name, false),
                }
              : undefined,
          })}
        </div>
      ))}

      {errors.form && (
        <p role="alert" className="text-sm text-danger">
          {errors.form}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          Salvar credenciais
        </Button>
        {save.isSuccess && (
          <span role="status" className="text-sm text-ok-fg">
            Credenciais salvas
          </span>
        )}
      </div>
    </form>
  );
}
