document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const scrollOffset = 100; // Pixels offset for TOC active state calculation (adjust based on sticky header height)
    const themePreferenceKey = 'codeMasterThemePreference';
    const bookmarkStorageKey = 'codeMasterBookmarks';

    // --- Element Selectors ---
    const body = document.body;
    // Corrected: Use window for scroll events on the main page, or a specific container if that's intended
    // If #main-content-area is the intended scroll container (like in the CSS), use that.
    // Let's assume the main window scrolls for simplicity unless #main-content-area has overflow CSS.
    // If #main-content-area is the scroller:
    // const scrollContainer = document.getElementById('main-content-area');
    // Otherwise, use window:
    const scrollContainer = window;
    const mainContentAreaElement = document.getElementById('main-content-area'); // Still need this for progress calculation maybe

    const tocLinks = document.querySelectorAll('.toc-link');
    const contentSections = document.querySelectorAll('.content-section');
    const copyButtons = document.querySelectorAll('.copy-code-btn');
    const bookmarkButton = document.getElementById('bookmark-button');
    const bookmarkIcon = document.getElementById('bookmark-icon'); // Target the <i> tag inside bookmark button
    const shareButton = document.getElementById('share-button');
    const progressBar = document.getElementById('topic-progress-bar');
    const progressText = document.getElementById('topic-progress-text');
    const navItems = document.querySelectorAll('.nav-item');
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const themeIcon = document.getElementById('theme-icon'); // Target the <i> tag inside theme button
    const quizOptionGroups = document.querySelectorAll('.quiz-options');
    const tocElement = document.getElementById('table-of-contents'); // For scrolling TOC itself

    // --- Helper: Check if Element Exists ---
    const elementExists = (...elements) => elements.every(el => el != null);

    // --- Initial Setup ---
    if (typeof Prism !== 'undefined') {
        Prism.highlightAll();
    } else {
        console.warn("Prism syntax highlighter not found.");
    }

    applyInitialTheme(); // Apply theme first
    setupBookmarkState(); // Load bookmark state
    updateProgressBar(); // Initial progress bar state
    handleScroll(); // Set initial active TOC state

    // --- Event Listeners ---

    // Scroll listener - use window or the specific scroll container
    if (elementExists(mainContentAreaElement) && tocLinks.length > 0 && contentSections.length > 0) {
        scrollContainer.addEventListener('scroll', throttle(handleScroll, 100));
    }

    // Copy buttons
    copyButtons.forEach(button => {
        if (elementExists(button)) {
            button.addEventListener('click', handleCopyCode);
        }
    });

    // Bookmark button
    if (elementExists(bookmarkButton)) {
        bookmarkButton.addEventListener('click', toggleBookmark);
    }

    // Share button
    if (elementExists(shareButton)) {
        shareButton.addEventListener('click', shareContent);
    }

    // Theme toggle button
    if (elementExists(themeToggleButton)) {
        themeToggleButton.addEventListener('click', toggleTheme);
    }

    // Quiz answer changes
    quizOptionGroups.forEach(group => {
        if (elementExists(group)) {
            group.addEventListener('change', handleQuizAnswer);
        }
    });

    // --- Functions ---

    function applyInitialTheme() {
        const savedTheme = localStorage.getItem(themePreferenceKey);
        // Prefers-color-scheme is a fallback if no preference saved
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            setTheme('dark');
        } else {
            setTheme('light'); // Default to light
        }
    }

    function setTheme(theme) { // theme = 'light' or 'dark'
        if (!elementExists(body)) return;
        // Ensure only one theme class is applied
        body.classList.remove('light-theme', 'dark-theme');
        body.classList.add(theme + '-theme');

        localStorage.setItem(themePreferenceKey, theme);

        if (elementExists(themeIcon)) {
            // Update the icon class based on the new theme
            themeIcon.className = `fas fa-${theme === 'dark' ? 'moon' : 'sun'}`;
        } else {
             console.warn("Theme icon element not found.");
        }
        console.log(`Theme set to: ${theme}`);
    }

    function toggleTheme() {
        if (!elementExists(body)) return;
        const currentTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }

    function handleScroll() {
        if (tocLinks.length === 0 || contentSections.length === 0) return;

        let currentSectionId = '';
        // Determine scroll position based on window or container
        const scrollPosition = (scrollContainer === window ? window.pageYOffset : scrollContainer.scrollTop) + scrollOffset;

        // Find the current section in view
        contentSections.forEach(section => {
            // Check if the section exists and has an offsetTop
            if (elementExists(section) && typeof section.offsetTop === 'number') {
                 if (section.offsetTop <= scrollPosition && section.offsetTop + section.offsetHeight > scrollPosition) {
                     currentSectionId = section.id;
                 }
            } else {
                 console.warn("Content section missing or invalid:", section);
            }
        });

        // Update TOC links active state
        tocLinks.forEach(link => {
            if (!elementExists(link)) return;
            link.classList.remove('active');
            const href = link.getAttribute('href'); // Get the href value like '#introduction'
            // Check if href exists and matches the current section ID (removing the '#')
            if (href && href.startsWith('#') && href.substring(1) === currentSectionId) {
                link.classList.add('active');
                // Optional: Scroll TOC to keep active link in view
                scrollTocIntoView(link);
            }
        });

        // Update Progress Bar
        updateProgressBar();
    }

     function scrollTocIntoView(activeLink) {
         if (!elementExists(tocElement, activeLink)) return;

         const tocRect = tocElement.getBoundingClientRect();
         const linkRect = activeLink.getBoundingClientRect();

         // Check if link is (partially) outside the visible TOC area
         if (linkRect.top < tocRect.top || linkRect.bottom > tocRect.bottom) {
             tocElement.scrollTo({
                 top: activeLink.offsetTop - (tocElement.clientHeight / 2) + (activeLink.offsetHeight / 2), // Center it roughly
                 behavior: 'smooth'
             });
         }
     }

    function updateProgressBar() {
        if (!elementExists(progressBar, progressText, mainContentAreaElement)) {
             console.warn("Progress bar elements not found.");
             return;
        }

        // Calculate progress based on the main content area's scroll height vs visible height
        const contentHeight = mainContentAreaElement.scrollHeight - mainContentAreaElement.clientHeight;
        const currentScroll = mainContentAreaElement.scrollTop; // Use the element's scrolltop
        let progress = 0;

        if (contentHeight > 0) {
            progress = Math.min(Math.max((currentScroll / contentHeight) * 100, 0), 100); // Ensure 0-100 range
        } else if (mainContentAreaElement.scrollTop >= 0 && mainContentAreaElement.scrollHeight <= mainContentAreaElement.clientHeight) {
            // Content doesn't fill the scroll area, consider it 100%
             progress = 100;
        }


        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}% Complete`;
    }


    function handleCopyCode(event) {
        const button = event.currentTarget;
        if (!elementExists(button)) return;

        const targetId = button.dataset.target;
        const icon = button.querySelector('.copy-icon'); // Find the icon within the button
        if (!targetId || !elementExists(icon)) {
             console.warn("Copy button missing target or icon.", button);
             return;
        }

        const codeElement = document.getElementById(targetId);
        if (!elementExists(codeElement)) {
             console.warn("Code element to copy not found:", targetId);
             return;
        }

        // Use textContent for better compatibility with Prism structure
        const codeToCopy = codeElement.textContent || "";

        navigator.clipboard.writeText(codeToCopy).then(() => {
            // Success: Provide visual feedback
            icon.classList.remove('far', 'fa-copy');
            icon.classList.add('fas', 'fa-check', 'copy-success');

            setTimeout(() => {
                // Reset icon after a delay
                 if (elementExists(icon)) { // Check again in case element is removed
                    icon.classList.remove('fas', 'fa-check', 'copy-success');
                    icon.classList.add('far', 'fa-copy');
                 }
            }, 1500); // Reset after 1.5 seconds

        }).catch(err => {
            // Error: Provide visual feedback
            console.error('Failed to copy code: ', err);
            icon.classList.remove('far', 'fa-copy');
            icon.classList.add('fas', 'fa-times', 'copy-fail');

            setTimeout(() => {
                // Reset icon after a delay
                 if (elementExists(icon)) { // Check again
                    icon.classList.remove('fas', 'fa-times', 'copy-fail');
                    icon.classList.add('far', 'fa-copy');
                 }
            }, 1500);
        });
    }

    function setupBookmarkState() {
         const pageUrl = window.location.pathname; // Use pathname as a simple unique ID
         let bookmarks = {};
         try {
             bookmarks = JSON.parse(localStorage.getItem(bookmarkStorageKey) || '{}');
         } catch (e) {
             console.error("Error parsing bookmarks from localStorage", e);
             bookmarks = {}; // Reset if parsing fails
         }

         const isBookmarked = bookmarks[pageUrl] === true;

         if (elementExists(bookmarkButton, bookmarkIcon)) {
             if (isBookmarked) {
                 bookmarkButton.classList.add('bookmarked');
                 bookmarkIcon.classList.remove('far'); // Regular bookmark icon
                 bookmarkIcon.classList.add('fas'); // Solid bookmark icon
             } else {
                 bookmarkButton.classList.remove('bookmarked');
                 bookmarkIcon.classList.remove('fas'); // Solid icon
                 bookmarkIcon.classList.add('far'); // Regular icon
             }
         } else {
              console.warn("Bookmark button or icon element not found.");
         }
     }

     function toggleBookmark() {
         if (!elementExists(bookmarkButton, bookmarkIcon)) {
             console.warn("Cannot toggle bookmark: button or icon element not found.");
             return;
         }

         const pageUrl = window.location.pathname;
         let bookmarks = {};
          try {
             bookmarks = JSON.parse(localStorage.getItem(bookmarkStorageKey) || '{}');
         } catch (e) {
             console.error("Error parsing bookmarks from localStorage", e);
             bookmarks = {};
         }

         let isNowBookmarked;

         if (bookmarks[pageUrl] === true) {
             delete bookmarks[pageUrl]; // Remove bookmark
             bookmarkButton.classList.remove('bookmarked');
             bookmarkIcon.classList.remove('fas');
             bookmarkIcon.classList.add('far');
             isNowBookmarked = false;
         } else {
             bookmarks[pageUrl] = true; // Add bookmark
             bookmarkButton.classList.add('bookmarked');
             bookmarkIcon.classList.remove('far');
             bookmarkIcon.classList.add('fas');
             isNowBookmarked = true;
         }

         try {
             localStorage.setItem(bookmarkStorageKey, JSON.stringify(bookmarks));
             console.log(`Bookmark ${isNowBookmarked ? 'added' : 'removed'} for: ${pageUrl}`);
         } catch (e) {
             console.error("Error saving bookmarks to localStorage", e);
             alert("Could not save bookmark preference."); // Inform user
         }
     }

     async function shareContent() {
         const pageTitle = document.title || 'CodeMaster Lesson';
         const pageDescription = document.querySelector('.topic-description')?.textContent || 'Check out this lesson!';
         const pageUrl = window.location.href;

         const shareData = {
              title: pageTitle,
              text: pageDescription,
              url: pageUrl
          };

          try {
              if (navigator.share) {
                  await navigator.share(shareData);
                  console.log('Content shared successfully via Web Share API');
              } else {
                  // Fallback for browsers without navigator.share
                  console.log('Web Share API not supported. Falling back to clipboard copy.');
                  navigator.clipboard.writeText(shareData.url).then(() => {
                      alert('Link copied to clipboard!'); // Simple feedback
                  }).catch(err => {
                      console.error('Fallback clipboard copy failed:', err);
                      alert('Could not copy link. Please copy the URL manually.'); // Error feedback
                  });
              }
          } catch (err) {
              // Handle errors from navigator.share (e.g., user cancelling)
              // Don't log cancellation errors as actual errors unless needed
              if (err.name !== 'AbortError') {
                 console.error('Error sharing content:', err);
                 alert('Sharing failed.'); // Generic share error feedback
              } else {
                   console.log('Sharing aborted by user.');
              }
          }
      }


      function handleQuizAnswer(event) {
          const selectedRadio = event.target;
          // Ensure it was a radio button that changed
          if (!selectedRadio || selectedRadio.type !== 'radio') return;

          // Find the parent '.quiz-options' container [cite: 341, 342]
          const optionsContainer = selectedRadio.closest('.quiz-options');
          if (!elementExists(optionsContainer)) return;

          // Find the feedback element, assuming it's the next sibling [cite: 342]
          const feedbackElement = optionsContainer.nextElementSibling;
          if (!elementExists(feedbackElement) || !feedbackElement.classList.contains('quiz-feedback')) {
                console.warn("Quiz feedback element not found or invalid for:", optionsContainer);
                return;
          }

          // Get the correct answer from the dataset [cite: 340]
          const correctAnswer = optionsContainer.dataset.correct;
          if (correctAnswer == null) {
               console.warn("Quiz container missing 'data-correct' attribute:", optionsContainer);
               return;
          }

          // Clear previous feedback styles
           feedbackElement.classList.remove('correct', 'incorrect');
           feedbackElement.style.display = 'none'; // Hide initially
           feedbackElement.textContent = ''; // Clear text


          // Check the answer
          if (selectedRadio.value === correctAnswer) {
               feedbackElement.textContent = 'Correct! 🎉 Well done.';
               feedbackElement.classList.add('correct'); // Apply correct styling [cite: 223, 224]
           } else {
               // Use template literals for cleaner text construction
               feedbackElement.textContent = `Not quite! The correct tag is <${correctAnswer}>.`;
               feedbackElement.classList.add('incorrect'); // Apply incorrect styling [cite: 225, 226]
           }

           feedbackElement.style.display = 'block'; // Show feedback
       }


    // --- Utility Functions ---
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

}); // End DOMContentLoaded


// --- Global Functions (Can be called directly from HTML onclick attributes) ---

function goBack() {
     // Add check if history has items to go back to?
     if (window.history.length > 1) {
         window.history.back();
     } else {
         console.log("No history to go back to.");
         // Optionally, redirect to a default page like '/'
         // window.location.href = '/';
     }
 }

function handleNavClick(event, section) {
     // Prevent default anchor behavior if it's an anchor element
     if (event && event.preventDefault) {
        event.preventDefault();
     }
     console.log(`Attempting to navigate to section/page: ${section}`);

     // Placeholder: Implement actual navigation logic here.
     // This could involve:
     // 1. Loading new page content via AJAX/Fetch
     // 2. Scrolling to a section on the *current* page (if applicable)
     // 3. Redirecting to a different URL

     // Update active state visually on the clicked item
     const clickedItem = event.currentTarget;
     if (clickedItem) {
          // Remove active class from all nav items first
         document.querySelectorAll('.nav-item').forEach(item => {
             if (item) item.classList.remove('active');
          });
          // Add active class to the clicked item
         clickedItem.classList.add('active');
     } else {
          console.warn("Could not identify clicked nav item.");
     }
 }

// --- Function to handle "Try it yourself" button ---
function openCodeEditor(codeElementId) {
    const codeElement = document.getElementById(codeElementId);
    if (codeElement) {
        const code = codeElement.textContent || ""; // Use textContent
        console.log("Preparing code snippet for editor:", codeElementId);

        try {
            // Store the code in localStorage before navigating
            localStorage.setItem('codeToEdit', code);
            console.log("Code stored in localStorage.");

            // Redirect to the editor page (MAKE SURE 'editor.html' IS THE CORRECT FILENAME)
            window.location.href = 'editor.html'; // <-- CHANGE 'editor.html' if your editor file has a different name

        } catch (e) {
            console.error("Error storing code in localStorage:", e);
            alert('Could not prepare code for editor. Storage might be full or disabled.');
        }

    } else {
        console.error("Code element not found for editor:", codeElementId);
        alert('Error: Could not find the code snippet to edit.');
    }
}
