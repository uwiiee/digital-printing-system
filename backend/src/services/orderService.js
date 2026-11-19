const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};

// Checks one set of answers against the product's questions. Returns cleaned specs.
export function validateSpecs(product, rawSpecs) {
  const raw = rawSpecs && typeof rawSpecs === "object" ? rawSpecs : {};
  const specs = {};

  for (const field of product.formFields) {
    const value = raw[field.key];
    const label = `${product.name}: ${field.label}`;

    if (field.inputType === "number") {
      if (value === undefined || value === null || value === "") {
        if (field.required) fail(`${label} is required`);
        continue;
      }
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0 || n > 1000)
        fail(`${label} must be a number from 0 to 1000`);
      specs[field.key] = n;
    } else if (field.inputType === "select") {
      if (value === undefined || value === null || value === "") {
        if (field.required) fail(`${label} is required`);
        continue;
      }
      if (!field.options.includes(value))
        fail(`${label} has an invalid choice`);
      specs[field.key] = value;
    } else {
      const text = typeof value === "string" ? value.trim() : "";
      if (!text) {
        if (field.required) fail(`${label} is required`);
        continue;
      }
      if (text.length > 200) fail(`${label} is too long`);
      specs[field.key] = text;
    }
  }
  return specs;
}

// Example price for ONE unit. The admin still sets the final price manually.
export function estimateUnitPrice(product, specs) {
  if (product.pricingType === "per_sq_ft") {
    return (
      Math.round(product.examplePrice * specs.width * specs.height * 100) / 100
    );
  }
  return product.examplePrice;
}
