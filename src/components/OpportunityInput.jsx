export default function OpportunityInput({ value, onChange }) {
  const maxLength = 18;
  const isValid = value.length === maxLength;
  const isEmpty = value.length === 0;

  const handleChange = (e) => {
    const newValue = e.target.value.slice(0, maxLength);
    onChange(newValue);
  };

  return (
    <div className="w-full">
      <label htmlFor="opportunity-id" className="block text-sm font-medium text-gray-700 mb-2">
        Opportunity ID
      </label>

      <div className="relative">
        <input
          id="opportunity-id"
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="Enter 18-character Opportunity ID"
          className={`
            w-full px-4 py-3 rounded-md border transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            ${isEmpty
              ? 'border-gray-300 focus:border-[#0066cc] focus:ring-blue-100'
              : isValid
                ? 'border-green-500 focus:border-green-500 focus:ring-green-100 bg-green-50'
                : 'border-yellow-400 focus:border-yellow-400 focus:ring-yellow-100 bg-yellow-50'
            }
          `}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <span className={`text-sm font-medium ${isValid ? 'text-green-600' : 'text-gray-400'}`}>
            {value.length}/{maxLength}
          </span>

          {isValid && (
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {!isEmpty && !isValid && (
        <p className="mt-2 text-sm text-yellow-600">
          {maxLength - value.length} more character{maxLength - value.length !== 1 ? 's' : ''} needed
        </p>
      )}
    </div>
  );
}
