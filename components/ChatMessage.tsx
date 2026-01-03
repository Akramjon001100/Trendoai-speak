import React from 'react';
import { ChatMessage as ChatMessageType } from '../types';

interface Props {
  message: ChatMessageType;
}

const ChatMessage: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';
  
  // Custom renderer to find patterns like "1. Word" or "1) Word" and highlight the number in red
  const renderContent = (text: string) => {
      // Split text by newlines to process line by line for better list control
      return text.split('\n').map((line, index) => {
          // Regex to detect "1. Word" or "1) Word" patterns at start of line
          // \d+ matches numbers, [\.\)] matches dot or parenthesis
          const match = line.match(/^(\d+[\.\)])\s*(.*)/);
          
          if (match && !isUser) {
              // match[1] is the number (e.g., "1."), match[2] is the rest of the text
              return (
                  <div key={index} className="flex items-start mb-2 mt-1">
                      <span className="text-red-600 font-extrabold text-lg mr-2 min-w-[24px]">
                          {match[1]}
                      </span>
                      <span className="pt-0.5 font-medium">{match[2]}</span>
                  </div>
              );
          }
          
          // Render regular text lines with slight visual spacing
          // If line is empty, render a spacer
          return (
            <div key={index} className={`${line.trim() === '' ? 'h-2' : 'mb-1 leading-relaxed'}`}>
                {line}
            </div>
          );
      });
  };

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[85%] px-5 py-4 rounded-2xl text-sm md:text-base shadow-sm
        ${isUser 
          ? 'bg-blue-600 text-white rounded-br-none' 
          : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none shadow-md'
        }`}
      >
        {renderContent(message.text)}
      </div>
    </div>
  );
};

export default ChatMessage;