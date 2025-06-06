// frontend/src/apps/CalculatorApp.js
import React, { useState } from 'react';

const CalculatorApp = () => {
  const [input, setInput] = useState('0');
  const [currentOperation, setCurrentOperation] = useState(null);
  const [prevValue, setPrevValue] = useState(null);
  const [resetInput, setResetInput] = useState(false);

  const handleDigitClick = (digit) => {
    if (resetInput) {
      setInput(digit);
      setResetInput(false);
    } else {
      setInput(prev => (prev === '0' ? digit : prev + digit));
    }
  };

  const handleDecimalClick = () => {
    if (resetInput) {
      setInput('0.');
      setResetInput(false);
    } else if (!input.includes('.')) {
      setInput(prev => prev + '.');
    }
  };

  const handleOperationClick = (operation) => {
    if (prevValue === null) {
      setPrevValue(parseFloat(input));
    } else if (currentOperation) {
      const result = calculate(prevValue, parseFloat(input), currentOperation);
      setInput(result.toString());
      setPrevValue(result);
    }
    setCurrentOperation(operation);
    setResetInput(true);
  };

  const handleEqualsClick = () => {
    if (currentOperation && prevValue !== null) {
      const result = calculate(prevValue, parseFloat(input), currentOperation);
      setInput(result.toString());
      setPrevValue(null);
      setCurrentOperation(null);
      setResetInput(true);
    }
  };

  const handleClear = () => {
    setInput('0');
    setCurrentOperation(null);
    setPrevValue(null);
    setResetInput(false);
  };

  const handleSignChange = () => {
    setInput(prev => (parseFloat(prev) * -1).toString());
  };

  const handlePercentage = () => {
    setInput(prev => (parseFloat(prev) / 100).toString());
  };

  const calculate = (num1, num2, operation) => {
    switch (operation) {
      case '+': return num1 + num2;
      case '-': return num1 - num2;
      case '*': return num1 * num2;
      case '/': return num1 / num2;
      default: return num2;
    }
  };

  const buttons = [
    { label: 'AC', onClick: handleClear, className: 'bg-gray-600 hover:bg-gray-700' },
    { label: '+/-', onClick: handleSignChange, className: 'bg-gray-600 hover:bg-gray-700' },
    { label: '%', onClick: handlePercentage, className: 'bg-gray-600 hover:bg-gray-700' },
    { label: '/', onClick: () => handleOperationClick('/'), className: 'bg-orange-500 hover:bg-orange-600' },

    { label: '7', onClick: () => handleDigitClick('7') },
    { label: '8', onClick: () => handleDigitClick('8') },
    { label: '9', onClick: () => handleDigitClick('9') },
    { label: '*', onClick: () => handleOperationClick('*'), className: 'bg-orange-500 hover:bg-orange-600' },

    { label: '4', onClick: () => handleDigitClick('4') },
    { label: '5', onClick: () => handleDigitClick('5') },
    { label: '6', onClick: () => handleDigitClick('6') },
    { label: '-', onClick: () => handleOperationClick('-'), className: 'bg-orange-500 hover:bg-orange-600' },

    { label: '1', onClick: () => handleDigitClick('1') },
    { label: '2', onClick: () => handleDigitClick('2') },
    { label: '3', onClick: () => handleDigitClick('3') },
    { label: '+', onClick: () => handleOperationClick('+'), className: 'bg-orange-500 hover:bg-orange-600' },

    { label: '0', onClick: () => handleDigitClick('0'), className: 'col-span-2' },
    { label: '.', onClick: handleDecimalClick },
    { label: '=', onClick: handleEqualsClick, className: 'bg-orange-500 hover:bg-orange-600' },
  ];

  return (
    <div className="flex flex-col h-full items-center justify-center bg-gray-800 p-4 rounded-lg">
      <div className="w-full max-w-xs bg-gray-900 rounded-lg shadow-lg overflow-hidden">
        {/* Display */}
        <div className="p-4 text-right text-white text-4xl font-light overflow-hidden whitespace-nowrap">
          {input}
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-4 gap-1 p-2">
          {buttons.map((button, index) => (
            <button
              key={index}
              onClick={button.onClick}
              className={`p-4 text-white text-xl font-semibold rounded-full transition-colors duration-200
                ${button.className || 'bg-gray-700 hover:bg-gray-600'}
                ${button.label === '0' ? 'col-span-2' : ''}
              `}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalculatorApp;